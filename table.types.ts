
export interface ColumnDefinition
{
    name: string;
    align?: 'left'|'center'|'right';

    key: string | ((o:Object) => string);
    hidden?: boolean;
    nosort?: boolean;
    nomove?: boolean;
    
    minWidth: number;
    maxWidth?: number;
}

export interface ColumnIdMap
{
    [id: string]: ColumnDefinition
}

export interface TableDefinition
{
    columns: ColumnIdMap;
    defaultOrder: string[];
    defaultWidths?: number[];

    cacheToLocalStorage: boolean;
    LocalStorageKey?: string;

    advancedAnimations: boolean;
}

export interface TableCache extends Object
{
    order: string[];
    widths: number[];
}
