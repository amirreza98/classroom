import { Breadcrumb } from '@/components/refine-ui/layout/breadcrumb';
import { ListView } from '@/components/refine-ui/views/list-view';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateButton } from '@/components/refine-ui/buttons/create';
import { ShowButton } from '@/components/refine-ui/buttons/show';
import { EditButton } from '@/components/refine-ui/buttons/edit';
import { DeleteButton } from '@/components/refine-ui/buttons/delete';
import { useTable } from '@refinedev/react-table';
import { useList } from '@refinedev/core';
import { Subject, Department } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/refine-ui/data-table/data-table';

function SubjectsList() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');

    const { query: deptsQuery } = useList<Department>({ resource: 'departments', pagination: { pageSize: 100 } });
    const departments = deptsQuery?.data?.data ?? [];

    const departmentFilters = selectedDepartment === 'all' ? [] : [
        { field: 'department', operator: 'eq' as const, value: selectedDepartment }
    ];
    const searchFilters = searchQuery ? [
        { field: 'name', operator: 'contains' as const, value: searchQuery }
    ] : [];

    const subjectTable = useTable<Subject>({
        columns: useMemo<ColumnDef<Subject>[]>(() => [
            {
                id: 'code',
                accessorKey: 'code',
                size: 100,
                header: () => <p className="column-title">Code</p>,
                cell: ({ getValue }) => <Badge variant="outline" className="font-mono">{getValue<string>()}</Badge>
            },
            {
                id: 'name',
                accessorKey: 'name',
                size: 200,
                header: () => <p className="column-title">Name</p>,
                cell: ({ getValue }) => <span className="text-foreground font-medium">{getValue<string>()}</span>,
            },
            {
                id: 'department',
                accessorKey: 'department.name',
                size: 150,
                header: () => <p className="column-title">Department</p>,
                cell: ({ getValue }) => <Badge variant="secondary">{getValue<string>() ?? '—'}</Badge>,
            },
            {
                id: 'description',
                accessorKey: 'description',
                size: 250,
                header: () => <p className="column-title">Description</p>,
                cell: ({ getValue }) => <span className="truncate text-sm text-muted-foreground">{getValue<string>() ?? '—'}</span>,
            },
            {
                id: 'actions',
                size: 180,
                header: () => <p className="column-title">Actions</p>,
                cell: ({ row }) => (
                    <div className="flex gap-1">
                        <ShowButton resource="subjects" recordItemId={row.original.id} variant="outline" size="sm" />
                        <EditButton resource="subjects" recordItemId={row.original.id} variant="outline" size="sm" />
                        <DeleteButton resource="subjects" recordItemId={row.original.id} variant="outline" size="sm" />
                    </div>
                )
            }
        ], []),
        refineCoreProps: {
            resource: 'subjects',
            pagination: { pageSize: 10, mode: 'server' },
            filters: { permanent: [...departmentFilters, ...searchFilters] },
            sorters: { initial: [{ field: 'id', order: 'desc' }] },
        }
    });

    return (
        <ListView>
            <Breadcrumb />
            <h1 className="page-title">Subjects</h1>
            <div className="intro-row">
                <p>Manage academic subjects and their departments.</p>
                <div className="actions-row">
                    <div className="search-field">
                        <Search className="search-icon" />
                        <Input type="text" placeholder="Search by name or code..." className="pl-10 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(dept => (
                                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <CreateButton resource="subjects" />
                    </div>
                </div>
            </div>
            <DataTable table={subjectTable} />
        </ListView>
    );
}

export default SubjectsList;
