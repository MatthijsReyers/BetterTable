import { Component, Input, OnInit } from '@angular/core';
import { ColumnDefinition, TableDefinition } from './table.types';

@Component({
	selector: 'matt-table',
	templateUrl: './table.component.html',
	styleUrls: ['./table.component.scss']
})
export class TableComponent implements OnInit 
{
	@Input() definition: TableDefinition;
	@Input() data: Object[];

	constructor() { }

	ngOnInit()
	{
		
	}

	extractData(row: Object, col: ColumnDefinition): string
	{
		if (typeof col.key === 'string') return row[col.key];
		else return col.key(row);
	}

	alert(x:any) {alert(JSON.stringify(x));}

}
