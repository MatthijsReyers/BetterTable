
export interface ColumnDefinition
{
    name: string;
    align?: 'left'|'center'|'right';

    key: string | ((Object)=>string);
    hidden?: boolean;
    nosort?: boolean;
    
    minWidth: number;
    maxWidth?: number;
}

export interface TableDefinition
{
    left: ColumnDefinition[];
    movable: ColumnDefinition[];
    right: ColumnDefinition[];
}
