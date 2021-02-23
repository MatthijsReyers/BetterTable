import { Component, Input, OnInit, ViewChild, ElementRef, HostBinding, HostListener } from '@angular/core';
import { ColumnDefinition, TableCache, TableDefinition } from './table.types';

@Component({
	selector: 'better-table',
	templateUrl: './table.component.html',
	styleUrls: ['./table.component.scss']
})
export class BetterTableComponent implements OnInit
{
	@Input() definition: TableDefinition;
	@Input() data: object[];

	@ViewChild('headerElement', {static: true}) headerElement: ElementRef;
	@ViewChild('bodyElement', 	{static: true})	bodyElement: ElementRef;

	static CACHE_NO_KEY_ERROR: string = 'SmartTable: cache to LocalStorage was enabled but no key was provided.';
	static CACHE_INCOMPLETE_ERROR: string = 'SmartTable: cache exists but is missing one or more expected values.';
	static CACHE_INVALID_ERROR: string = 'SmartTable: cache contains invalid values.';
	static CACHE_OUTDATED_LOG: string = 'SmartTable: overwriting cached column order because order in definition contains more columns';

	public order: string[] = [];
	public widths: number[] = [];

	ngOnInit()
	{
		this.order = this.definition.defaultOrder;

		// CHECK: is caching column order enabled?
		if (this.definition.cacheToLocalStorage) 
			this.loadCache();
	}

	loadCache()
	{
		// CHECK: has a localstorage key actually been provided?
		if (!this.definition.LocalStorageKey)
			return console.error(BetterTableComponent.CACHE_NO_KEY_ERROR);
		
		// CHECK: does the localstorage actually contain anything?
		const raw = localStorage.getItem(this.definition.LocalStorageKey);
		if (raw) {

			const cache: TableCache = JSON.parse(raw);

			// // CHECK: does the cache have all expected properties?
			// const cacheKeys = Object.keys(cache);
			// if (!('order' in cacheKeys) || !('widths' in cacheKeys))
			// 	return console.log(SmartTableComponent.CACHE_INCOMPLETE_ERROR);

			// // CHECK: have new columns been added since last cache was created?
			// if (cache['order'].length !== this.order.length)
			// 	return console.log(SmartTableComponent.CACHE_OUTDATED_LOG);
				
			// // CHECK: does the cache contain any obvious errors?
			// if (cache['order'].length !== cache['widths'].length)
			// 	return console.log(SmartTableComponent.CACHE_INVALID_ERROR);

			this.order = cache['order'];
			this.widths = cache['widths'];
		}
	}

	updateCache()
	{
		// CHECK: has a localstorage key actually been provided?
		if (!this.definition.LocalStorageKey) 
			console.error(BetterTableComponent.CACHE_NO_KEY_ERROR);

		else {
			localStorage.setItem(
				this.definition.LocalStorageKey,
				JSON.stringify({
					'order':this.order,
					'widths':this.widths
				})
			);
		}
	}

	extractData(row: Object, columnDef: ColumnDefinition): string
	{
		if (typeof columnDef.key === 'string') return row[columnDef.key];
		else return columnDef.key(row);
	}

	@HostListener('window:mouseup')
	public onMouseUp()
	{
		if (this.currentlyMoving)
			this.onMovingStop();
		else this.onResizeStop();
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

		if (this.definition.advancedAnimations)
		{
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
	}

	public onMovingStop()
	{
		// CHECK: Do we even have to move anything?
		if (this.movingDestination != this.movingOrigin && this.movingDestination != -1)
		{
			// Remove and temporarily store moved value.
			const tmp = this.order[this.movingOrigin];
			this.order.splice(this.movingOrigin, 1);

			// Insert at new location.
			if (this.movingOrigin < this.movingDestination)
				this.order.splice(this.movingDestination-1, 0, tmp);
			else this.order.splice(this.movingDestination, 0, tmp);

			this.updateCache();
		}

		// Reset 'advanced' animations
		if (this.definition.advancedAnimations)
		{
			let headerChildren: HTMLElement[] = this.headerElement.nativeElement.children;
			let bodyChildren: HTMLElement[] = this.bodyElement.nativeElement.children;

			for (let i = 0; i < bodyChildren.length; i++) {
				headerChildren[i].style['left'] = '0px';
				bodyChildren[i].style['left'] = '0px';
			}
		}
		
		this.currentlyMoving = false;
		this.movingOrigin = -1;
		this.movingDestination = -1;
	}

	// =================================================================================================
	// Column resizing related code.
	// =================================================================================================
	private currentlyResizing: boolean = false;
	private resizedColumnIndex = -1;
	private resizeStartWidths: number[];
	private resizeStartPosX: number;

	public onResizeStart(index: number, event: MouseEvent)
	{
		if (!this.currentlyMoving)
		{
			this.currentlyResizing = true;
			this.resizedColumnIndex = index;
			this.resizeStartWidths = [
				this.bodyElement.nativeElement.children[index].offsetWidth,
				this.bodyElement.nativeElement.children[index+1].offsetWidth
			];
			this.resizeStartPosX = event.clientX;
		}
	}

	@HostListener('window:mousemove', ['$event'])
	public onResize(event: MouseEvent)
	{
		if (this.currentlyResizing)
		{
			let change: number = (this.resizeStartPosX - event.clientX);

			let oldWidths: number[] = [
				this.resizeStartWidths[0],
				this.resizeStartWidths[1]
			];

			let limits: number[] = [
				oldWidths[0] - this.definition.columns[this.order[this.resizedColumnIndex]].minWidth,			// Maximum that can be subscracted from column 0
				oldWidths[0] - (this.definition.columns[this.order[this.resizedColumnIndex]].maxWidth), 		// Maximum that can be added to column 0
				this.definition.columns[this.order[this.resizedColumnIndex+1]].minWidth - oldWidths[1],			// Maximum that can be subscracted from column 1
				(this.definition.columns[this.order[this.resizedColumnIndex+1]].maxWidth) - oldWidths[1] 		// Maximum that can be added to column 1
			];

			if (limits[0] < change) change = limits[0];
			if (limits[1] > change) change = limits[1];
			if (limits[2] > change) change = limits[2];
			if (limits[3] < change) change = limits[3];

			let newWidths: number[] = [
				this.resizeStartWidths[0] - change,
				this.resizeStartWidths[1] + change
			];

			// Temporarily set new width by forcing min/max-width CSS properities.
			for (const i of [0,1])
			{
				for (let elem of [this.headerElement.nativeElement,this.bodyElement.nativeElement])
				for (let properity of ['min-width','max-width'])
					elem.children[this.resizedColumnIndex + i].style[properity] = `${newWidths[i]}px`;
			}
		}
	}

	public onResizeStop()
	{
		let headerKids: HTMLElement[] = this.headerElement.nativeElement.children;
		let bodyKids: HTMLElement[] = this.bodyElement.nativeElement.children;

		let widths: number[] = [];
		for (let i = 0; i < this.order.length; i++) 
			widths.push(bodyKids[i].offsetWidth);

		for (let i = 0; i < this.order.length; i++) 
		{
			const definition = this.definition.columns[this.order[i]];
			const width = widths[i];

			headerKids[i].style.flexBasis = '';
			bodyKids[i].style.flexBasis = '';
			headerKids[i].style.flexBasis = width+'px';
			bodyKids[i].style.flexBasis = width+'px';
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

		this.currentlyResizing = false;
		this.resizedColumnIndex = -1;
	}
}
