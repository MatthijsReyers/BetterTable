import { Component, Input, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, HostBinding, HostListener } from '@angular/core';
import { TableDefinition, ColumnDefinition, TableCache, } from './table.types';

@Component({
	selector: 'better-table',
	templateUrl: './table.component.html',
	styleUrls: ['./table.component.scss']
})
export class BetterTable implements OnInit, OnDestroy, AfterViewInit
{
	@Input() definition: TableDefinition;
	@Input() data: object[];

	public order:  string[] = [];
	public widths: number[] = [];

	@ViewChild('headerElement', {static: true}) headerElement: ElementRef;
	@ViewChild('bodyElement', 	{static: true})	bodyElement: ElementRef;

	static NO_DEFINITION_ERROR:    string = 'SmartTable: definition object was null, did you add [definition]="yourDef" to the component?';
	static NO_DATA_ERROR: 		   string = 'SmartTable: data object was null, did you add [data]="yourData" to the component?';
	static CACHE_NO_KEY_ERROR: 	   string = 'SmartTable: cache to LocalStorage was enabled but no key was provided.';
	static CACHE_INCOMPLETE_ERROR: string = 'SmartTable: cache exists but is missing one or more expected values.';
	static CACHE_INVALID_ERROR:    string = 'SmartTable: cache contains invalid values.';
	static CACHE_OUTDATED_LOG:     string = 'SmartTable: overwriting cached column order because order in definition contains more columns';

	ngOnInit()
	{
		// Check for errors.
		if (this.definition === undefined) return console.error(BetterTable.NO_DEFINITION_ERROR);
		if (this.data === undefined) return console.error(BetterTable.NO_DATA_ERROR);

		this.order = this.definition.defaultOrder;
		if (this.definition.cacheToLocalStorage) 
			this.loadCache();

		this.scrollbarChangeObserver = new MutationObserver(()=>this.onScrollbarUpdate());
	}

	ngAfterViewInit()
	{
		this.setWidths();
		this.scrollbarChangeObserver.observe(
			this.bodyElement.nativeElement, 
			{childList: true, subtree: true}
		);
	}

	ngOnDestroy()
	{
		this.scrollbarChangeObserver.disconnect();
	}

	public extractData(row: Object, columnId: string): string
	{
		// If no key has been provided at all use the column def ID instead.
		// ======================================================================
		let key: any = this.definition.columns[columnId].key;
		if (!key) key = columnId;

		// Check if key is an index or lambda function.
		// ======================================================================
		if (typeof key === 'string') return row[key];
		else return key(row);
	}

	@HostListener('window:mouseup')
	public onMouseUp()
	{
		if (this.currentlyMoving)
			this.onMovingStop();
		else if (this.currentlyResizing)
			this.onResizeStop();
	}

	@HostListener('window:resize')
	public onWindowResize()
	{
		let bodyKids: HTMLElement[] = this.bodyElement.nativeElement.children;

		this.widths = [];
		for (let i = 0; i < this.order.length; i++) 
			this.widths.push(bodyKids[i].offsetWidth);
	}


	// =================================================================================================
	// Column width setting/getting/updating code.
	// =================================================================================================
	public updateWidths()
	{
		let bodyKids: HTMLElement[] = this.bodyElement.nativeElement.children;
		this.widths = [];
		for (let i = 0; i < this.order.length; i++) 
			this.widths.push(bodyKids[i].offsetWidth);
	}

	public setWidths()
	{
		let headerKids: HTMLElement[] = this.headerElement.nativeElement.children;
		let bodyKids: HTMLElement[] = this.bodyElement.nativeElement.children;

		for (let i = 0; i < this.widths.length; i++) 
		{
			const definition = this.definition.columns[this.order[i]];

			headerKids[i].style.flexBasis = `${this.widths[i]}px`;
			bodyKids[i].style.flexBasis = `${this.widths[i]}px`;
			headerKids[i].style.minWidth = definition.minWidth+'px';
			bodyKids[i].style.minWidth = definition.minWidth+'px';
			if (definition.maxWidth) {
				headerKids[i].style.maxWidth = definition.maxWidth+'px';
				bodyKids[i].style.maxWidth = definition.maxWidth+'px';
			}
			else {
				headerKids[i].style.maxWidth = '';
				bodyKids[i].style.maxWidth = '';
			}
		}
	}


	// =================================================================================================
	// LocalStorage caching related code.
	// =================================================================================================
	public loadCache()
	{
		// CHECK: has a localstorage key actually been provided?
		if (!this.definition.LocalStorageKey)
			return console.error(BetterTable.CACHE_NO_KEY_ERROR);
		
		// CHECK: does the localstorage actually contain anything?
		const raw = localStorage.getItem(this.definition.LocalStorageKey);
		if (raw) {

			const cache: TableCache = JSON.parse(raw);

			// CHECK: does the cache have all expected properties?
			const cacheKeys = Object.keys(cache);
			if (!cacheKeys.includes('order') || !cacheKeys.includes('widths'))
				return console.log(BetterTable.CACHE_INCOMPLETE_ERROR);

			// CHECK: have new columns been added since last cache was created?
			if (cache['order'].length < Object.keys(this.definition.columns).length)
				return console.log(BetterTable.CACHE_OUTDATED_LOG);
				
			// CHECK: does the cache contain any obvious errors?
			if (cache['order'].length !== cache['widths'].length)
				return console.log(BetterTable.CACHE_INVALID_ERROR);

			this.order = cache['order'];
			this.widths = cache['widths'];
		}
	}

	public updateCache()
	{
		// CHECK: has a localstorage key actually been provided?
		if (!this.definition.LocalStorageKey) 
			console.error(BetterTable.CACHE_NO_KEY_ERROR);

		else localStorage.setItem(
			this.definition.LocalStorageKey,
			JSON.stringify({
				'order':this.order,
				'widths':this.widths
			})
		);
	}


	// =================================================================================================
	// Scrollbar showing/hiding related code.
	// =================================================================================================
	public sortedColumn: string = 'name';
	public sortedReverse: boolean = false;

	public onSort(index: number, reverse: boolean)
	{
		this.sortedColumn = this.order[index];
		this.sortedReverse = reverse;

		let callback:any = this.definition.columns[this.order[index]].sortCallback;
		if (callback) callback(this.sortedReverse);
		
		else {
			callback = this.definition.globalSortCallback;
			if (callback) callback(this.sortedColumn, this.sortedReverse);
		}
	}


	// =================================================================================================
	// COLUMN MOVING/REORDERING RELATED CODE.
	// =================================================================================================
	@HostBinding('class.moving')
	public currentlyMoving: boolean = false;
	public movingOrigin: number = -1;
	public movingDestination: number = -1

	public onMovingStart(columnIndex: number)
	{
		if (!this.currentlyResizing)
		{
			this.currentlyMoving = true;
			this.movingOrigin = columnIndex;
		}
	}

	public onMoving(origin, columnIndex: number)
	{
		if (origin != this.movingOrigin)
			this.movingDestination = columnIndex;

		let headerChildren: HTMLElement[] = this.headerElement.nativeElement.children;
		let bodyChildren: HTMLElement[] = this.bodyElement.nativeElement.children;
		
		let offsetWidth = bodyChildren[this.movingOrigin].offsetWidth;
		let offset = 0;

		// Reset positions first.
		for (let i = 0; i < bodyChildren.length; i++) {
			headerChildren[i].style['left'] = `${0}px`;
			bodyChildren[i].style['left'] = `${0}px`;
		}

		for (let i = this.movingOrigin+1; i < this.movingDestination; i++) {
			headerChildren[i].style['left'] = `-${offsetWidth}px`;
			bodyChildren[i].style['left'] = `-${offsetWidth}px`;
			offset += bodyChildren[i].offsetWidth;
		}
		
		if (this.movingDestination != -1)
		for (let i = this.movingOrigin-1; i >= this.movingDestination && i > 0; i--) {
			headerChildren[i].style['left'] = `${offsetWidth}px`;
			bodyChildren[i].style['left'] = `${offsetWidth}px`;
			offset -= bodyChildren[i].offsetWidth;
		}

		headerChildren[this.movingOrigin].style['left'] = offset+'px';
		bodyChildren[this.movingOrigin].style['left'] = offset+'px';
	}

	public onMovingStop()
	{
		// CHECK: Do we even have to move anything?
		if (this.movingDestination != this.movingOrigin && this.movingDestination != -1)
		{
			for (let list of [this.order, this.widths])
			{
				// Remove and temporarily store moved value.
				const tmp: any = list[this.movingOrigin];
				list.splice(this.movingOrigin, 1);

				// Insert at new location.
				if (this.movingOrigin < this.movingDestination)
					list.splice(this.movingDestination-1, 0, tmp);
				else list.splice(this.movingDestination, 0, tmp);

				this.updateCache();
			}
		}

		// Reset column movement animations.
		let headerChildren: HTMLElement[] = this.headerElement.nativeElement.children;
		let bodyChildren: HTMLElement[] = this.bodyElement.nativeElement.children;
		for (let i = 0; i < bodyChildren.length; i++)
		{
			headerChildren[i].style['left'] = '0px';
			bodyChildren[i].style['left'] = '0px';
		}
		
		this.currentlyMoving = false;
		this.movingOrigin = -1;
		this.movingDestination = -1;
	}


	// =================================================================================================
	// Column widths/resizing related code.
	// =================================================================================================
	@HostBinding('class.resizing')
	private currentlyResizing: boolean = false;
	private resizeColumn = -1;
	private resizeStartPosX: number;

	private getMaxColumnShrink(col: number): number
	{
		return this.definition.columns[this.order[col]].minWidth - this.widths[col];
	}

	private getMaxColumnGrow(col: number): number
	{
		return this.definition.columns[this.order[col]].maxWidth - this.widths[col];
	}

	public onResizeStart(index: number, event: MouseEvent)
	{
		if (!this.currentlyMoving)
		{
			this.currentlyResizing = true;
			this.resizeColumn = index;
			this.resizeStartPosX = event.clientX;
		}
	}

	@HostListener('window:mousemove', ['$event'])
	public onResize(event: MouseEvent)
	{
		if (this.currentlyResizing)
		{
			// Will contain the temporary new widths.
			let newWidths = this.widths.slice();

			// Get the resize amount as requested by the cursor movement.
			let requestedChange = (event.clientX - this.resizeStartPosX);

			// Clamp change to what the column actually can be.
			const maxGrow = this.getMaxColumnGrow(this.resizeColumn);
			const maxShrink = this.getMaxColumnShrink(this.resizeColumn);
			if (requestedChange > maxGrow) requestedChange = maxGrow;
			if (requestedChange < maxShrink) requestedChange = maxShrink;

			// Programatically try to distribute the requested change among other columns.
			let availableChange = 0;
			for (let i = this.resizeColumn+1; i < this.order.length; i++) 
			{
				let change = -requestedChange - availableChange;

				const maxGrow = this.getMaxColumnGrow(i);
				const maxShrink = this.getMaxColumnShrink(i);

				if (change > maxGrow) change = maxGrow;
				if (change < maxShrink) change = maxShrink;

				newWidths[i] = this.widths[i] + change;
				availableChange += change;

				if (availableChange == -requestedChange) 
					break;
			}

			newWidths[this.resizeColumn] = this.widths[this.resizeColumn] - availableChange;

			// Temporarily set new width by forcing min/max-width CSS properities.
			for (let i = 0; i < newWidths.length; i++)
			for (let elem of [this.headerElement.nativeElement,this.bodyElement.nativeElement])
			for (let properity of ['minWidth','maxWidth']) {
				if (newWidths[i] && i >= this.resizeColumn)
					elem.children[i].style[properity] = `${newWidths[i]}px`;
				else elem.children[i].style[properity] = `${this.definition.columns[this.order[i]][properity]}px`;
			}
		}
	}

	public onResizeStop()
	{
		let headerKids: HTMLElement[] = this.headerElement.nativeElement.children;
		let bodyKids: HTMLElement[] = this.bodyElement.nativeElement.children;

		this.updateWidths();
		this.setWidths();

		this.currentlyResizing = false;
		this.resizeColumn = -1;

		this.updateCache();
	}


	// =================================================================================================
	// Scrollbar showing/hiding related code.
	// =================================================================================================
	@HostBinding('class.scrolling')
	public scrollbarVisible: boolean = false;
	private scrollbarChangeObserver: MutationObserver;
	
	private onScrollbarUpdate()
	{
		let el: HTMLElement = this.bodyElement.nativeElement;
		this.scrollbarVisible = (el.scrollHeight > el.clientHeight);

		if (this.scrollbarVisible)
		{
			this.headerElement.nativeElement.style['padding-right'] = this.getScrollbarWidth() + 'px';
		}

		this.onResizeStop();
	}

	private getScrollbarWidth(): number
	{
		// Creating invisible container
		const outer = document.createElement('div');
		outer.style
		outer.style['visibility'] = 'hidden';
		outer.style['overflow'] = 'scroll';
		outer.style['msOverflowStyle'] = 'scrollbar';
		document.body.appendChild(outer);
	  
		// Creating inner element and placing it in the container
		const inner = document.createElement('div');
		outer.appendChild(inner);
	  
		// Calculating difference between container's full width and the child width
		const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);
	  
		// Removing temporary elements from the DOM
		outer.parentNode.removeChild(outer);
	  
		return scrollbarWidth;
	}
}
