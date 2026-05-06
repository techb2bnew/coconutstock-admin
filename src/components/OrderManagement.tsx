'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Eye, Filter, Check, ChevronsUpDown, UserPlus, Image as ImageIcon, Upload, X, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Calendar, ChevronUp, CheckCircle2, Truck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderDetailsView } from './OrderDetailsView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import Autocomplete from 'react-google-autocomplete';

type SupaOrder = {
    id: number;
    order_name: string | null;
    logo: string | null;
    special_event_logo: string | null;
    customer_id: number | null;
    po_number: string | null;
    order_date: string | null;
    delivery_date: string | null;
    status: string | null;
    driver_id: number | null;
};

// Address Autocomplete Component
interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    isModalOpen?: boolean; // Track if modal is open
}

function AddressAutocomplete({ value, onChange, className, placeholder, isModalOpen = false }: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Fix z-index for Google Autocomplete dropdown and ensure click events work
    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'google-autocomplete-styles';
        style.textContent = `
            .pac-container {
                z-index: 99999 !important;
                position: fixed !important;
                pointer-events: auto !important;
            }
            .pac-item {
                cursor: pointer !important;
                padding: 8px !important;
                pointer-events: auto !important;
            }
            .pac-item:hover {
                background-color: #f3f4f6 !important;
            }
            .pac-item-selected {
                background-color: #e5e7eb !important;
            }
        `;

        // Remove existing style if present
        const existingStyle = document.getElementById('google-autocomplete-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        document.head.appendChild(style);

        // Initialize lastClickTarget if not exists
        if (!(window as any).lastClickTarget) {
            (window as any).lastClickTarget = null;
        }

        // Ensure click events work on pac-container - prevent modal from blocking
        const handlePacClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't block close button clicks - check for Radix UI close button
            if (target.closest('button[aria-label="Close"]') ||
                target.closest('[data-radix-dialog-close]') ||
                target.closest('button[type="button"]') && target.closest('[role="dialog"]') &&
                (target.closest('svg') || target.textContent?.trim() === '')) {
                // Allow close button to work normally
                return;
            }
            const pacContainer = target.closest('.pac-container');
            const pacItem = target.closest('.pac-item');
            if (pacContainer || pacItem) {
                // Store target to prevent modal from closing - do this FIRST
                (window as any).lastClickTarget = target;
                (window as any).isPacClick = true;
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Allow the click to proceed
                return true;
            }
        };

        // Add event listeners with capture phase to intercept before modal
        document.addEventListener('click', handlePacClick, true);
        document.addEventListener('mousedown', handlePacClick, true);
        document.addEventListener('mouseup', handlePacClick, true);

        // Also handle touch events for mobile
        document.addEventListener('touchend', handlePacClick as any, true);

        // Prevent overlay from closing dialog when clicking on pac-container
        const handleOverlayClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't block close button clicks - check for Radix UI close button
            if (target.closest('button[aria-label="Close"]') ||
                target.closest('[data-radix-dialog-close]') ||
                (target.closest('button[type="button"]') && target.closest('[role="dialog"]') &&
                    (target.closest('svg') || target.textContent?.trim() === ''))) {
                // Allow close button to work normally
                return;
            }
            // Check if click is on pac-container or pac-item
            if (target.closest('.pac-container') || target.closest('.pac-item')) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
                return false;
            }
        };

        // Listen for clicks on overlay (Radix UI uses data-radix-dialog-overlay)
        document.addEventListener('click', handleOverlayClick, true);

        // Fallback: Listen for clicks on pac-items directly
        const handlePacItemClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't block close button clicks - check for Radix UI close button
            const isCloseButton = target.closest('button[aria-label="Close"]') ||
                target.closest('[data-radix-dialog-close]') ||
                (target.closest('button') && target.closest('svg'));
            if (isCloseButton) {
                // Allow close button to work normally
                return;
            }
            const pacItem = target.closest('.pac-item');
            if (pacItem) {
                // Store the click target to prevent modal from closing - do this FIRST
                (window as any).lastClickTarget = target;
                (window as any).isPacClick = true;

                e.stopPropagation();
                e.stopImmediatePropagation();

                // Get the full address from pac-item
                const queryElement = pacItem.querySelector('.pac-item-query');
                const matchedElement = pacItem.querySelector('.pac-matched');
                const fullText = pacItem.textContent || '';

                // Try to get the formatted address
                let address = '';
                if (queryElement && matchedElement) {
                    // Combine query and matched parts
                    address = fullText.trim();
                } else {
                    address = fullText.trim();
                }

                if (address && inputRef.current) {
                    console.log('Fallback: Address selected:', address);
                    // Update the input value
                    inputRef.current.value = address;
                    // Trigger onChange
                    onChange(address);
                }

                // Clear the stored target after a delay to ensure Dialog handler sees it
                setTimeout(() => {
                    (window as any).lastClickTarget = null;
                    (window as any).isPacClick = false;
                }, 300);
            }
        };

        // Add event listener immediately, not with delay
        document.addEventListener('click', handlePacItemClick, true);

        return () => {
            const styleToRemove = document.getElementById('google-autocomplete-styles');
            if (styleToRemove) {
                styleToRemove.remove();
            }
            document.removeEventListener('click', handlePacClick, true);
            document.removeEventListener('mousedown', handlePacClick, true);
            document.removeEventListener('mouseup', handlePacClick, true);
            document.removeEventListener('touchend', handlePacClick as any, true);
            document.removeEventListener('click', handlePacItemClick, true);
            document.removeEventListener('click', handleOverlayClick, true);
        };
    }, [onChange, isModalOpen]);

    // Handle place selection
    const handlePlaceSelected = (place: any) => {
        console.log('Place selected:', place);
        const address = place.formatted_address || place.name || '';
        console.log('Address:', address);
        onChange(address);
        // Ensure input field is updated
        if (inputRef.current) {
            inputRef.current.value = address;
        }
    };

    return (
        <div className="relative" style={{ zIndex: 1 }}>
            <Autocomplete
                apiKey="AIzaSyBVlRB_xJNrgPjlukxTrCDCfjzYuqfN0Q0"
                onPlaceSelected={handlePlaceSelected}
                options={{
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                }}
                defaultValue={value || ''}
                className={className}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    height: '2.5rem',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    backgroundColor: '#f9fafb',
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onChange(e.target.value);
                }}
                ref={inputRef}
            />
        </div>
    );
}

export function OrderManagement() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [franchiseFilter, setFranchiseFilter] = useState('all');
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [orderDateFrom, setOrderDateFrom] = useState('');
    const [orderDateTo, setOrderDateTo] = useState('');
    const [deliveryDateFrom, setDeliveryDateFrom] = useState('');
    const [deliveryDateTo, setDeliveryDateTo] = useState('');
    const [sortBy, setSortBy] = useState('created_at_latest');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // modal & UI state
    const [isPlaceOrderDialogOpen, setIsPlaceOrderDialogOpen] = useState(false);
    const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<string>('');
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [isAssignDriverDialogOpen, setIsAssignDriverDialogOpen] = useState(false);
    const [selectedOrderForDriver, setSelectedOrderForDriver] = useState<string | null>(null);
    const [selectedDriverForAssignment, setSelectedDriverForAssignment] = useState('');
    const [customerLogoPreview, setCustomerLogoPreview] = useState<string | null>(null);
    const [loadingPlaceOrder, setLoadingPlaceOrder] = useState(false);
    const [loadingEditOrder, setLoadingEditOrder] = useState(false);
    const [loadingAssign, setLoadingAssign] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState('');
    const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
    const [isBulkAssignDriverDialogOpen, setIsBulkAssignDriverDialogOpen] = useState(false);
    const [selectedDriverForBulkAssignment, setSelectedDriverForBulkAssignment] = useState('');
    const [loadingBulkAssign, setLoadingBulkAssign] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // data from Supabase
    const [orders, setOrders] = useState<SupaOrder[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [companyLogoMap, setCompanyLogoMap] = useState<Map<string, string>>(new Map());
    const [drivers, setDrivers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [franchiseId, setFranchiseId] = useState<string | null | undefined>(undefined);
    const [franchises, setFranchises] = useState<any[]>([]);

    // new order form (keeps same fields you had)
    const [newOrder, setNewOrder] = useState({
        customerId: '',
        productType: '', // "Unit" or "Case" per your UI
        quantity: '',
        deliveryDate: '',
        deliveryAddress: '',
        driverId: '',
        paymentStatus: '',
        deliveryStatus: '',
        poNumber: '',
        specialInstructions: '',
        customerLogo: '',
        paymentMethod: '',
    });



    // --- helper derived UI functions (colors, mapping) ---
    const orderStatusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        'Order Placed': 'bg-yellow-100 text-yellow-800',
        'processing': 'bg-blue-100 text-blue-800',
        'pending payment': 'bg-yellow-100 text-yellow-800',
        'driver assigned': 'bg-cyan-100 text-cyan-800',
        'in transit': 'bg-indigo-100 text-indigo-800',
        'completed': 'bg-green-100 text-green-800',
        'cancelled': 'bg-red-100 text-red-800',
        'unable to driver': 'bg-orange-100 text-orange-800',
        Confirmed: 'bg-blue-100 text-blue-800',
        Ready: 'bg-purple-100 text-purple-800',
    };

    // Helper function to display status (pending shows as "Order Placed")
    const getDisplayStatus = (status: string | null) => {
        if (!status) return 'pending';
        return status === 'pending' ? 'Order Placed' : status;
    };

    // Helper function to convert camelCase status to display format
    const getDisplayDeliveryStatus = (status: string | null) => {
        if (!status) return 'Not Dispatched';
        const statusMap: Record<string, string> = {
            'processing': 'Processing',
            'pending payment': 'Pending payment',
            'driver assigned': 'Driver assigned',
            'in transit': 'In transit',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
            'unable to driver': 'Unable to driver',
        };
        return statusMap[status] || status;
    };

    const deliveryStatusColors: Record<string, string> = {
        'processing': 'bg-blue-100 text-blue-800',
        'pending payment': 'bg-yellow-100 text-yellow-800',
        'driver assigned': 'bg-cyan-100 text-cyan-800',
        'in transit': 'bg-indigo-100 text-indigo-800',
        'completed': 'bg-green-100 text-green-800',
        'cancelled': 'bg-red-100 text-red-800',
        'unable to driver': 'bg-orange-100 text-orange-800',
    };

    const getDriverStatusColor = (status: string) => {
        switch (status) {
            case 'Available':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'Assigned':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'En Route':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            default:
                return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    useEffect(() => {
        const statusParam = searchParams.get("status");
        if (!statusParam) return;
        // normalize
        const normalized = statusParam.toLowerCase().trim();
        // Only auto-apply when status=pending
        if (normalized === "pending") {
            setStatusFilter("pending");
            setIsAdvancedFiltersOpen(true); // optional: open filters so user can see it's applied
        }
    }, [searchParams]);

    // --- determine role (super admin) for UI & filters ---
    useEffect(() => {
        const superAdmin =
            typeof window !== 'undefined'
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;
        setIsSuperAdmin(superAdmin);
    }, []);

    // --- resolve franchise id from current logged-in user + fetch data from Supabase ---
    useEffect(() => {
        const resolveFranchise = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const email = session?.user?.email;
                if (!email) {
                    setFranchiseId(null);
                    return;
                }

                const { data: franchise, error } = await supabase
                    .from('franchises')
                    .select('id')
                    .eq('owner_email', email)
                    .maybeSingle();

                if (error) {
                    console.error('Franchise lookup error (orders):', error);
                    setFranchiseId(null);
                    return;
                }

                const id = franchise?.id ?? null;
                setFranchiseId(id);

                // Don't modify localStorage here - AdminLayout handles it
                // Only set it if we found a franchise (don't remove if not found)
                if (typeof window !== 'undefined' && id) {
                    localStorage.setItem('current_franchise_id', id);
                }
            } catch (err) {
                console.error('Franchise resolve error (orders):', err);
                setFranchiseId(null);
            }
        };

        void resolveFranchise();
    }, []);

    // --- fetch franchises for super admin so we can filter by franchise ---
    useEffect(() => {
        if (!isSuperAdmin) return;

        const fetchFranchises = async () => {
            try {
                const { data, error } = await supabase
                    .from('franchises')
                    .select('id, franchise_name')
                    .order('franchise_name', { ascending: true });

                if (error) {
                    console.error('Error fetching franchises for filter:', error);
                    return;
                }

                setFranchises(data || []);
            } catch (err) {
                console.error('Fetch franchises error (orders filter):', err);
            }
        };

        void fetchFranchises();
    }, [isSuperAdmin]);

    useEffect(() => {
        if (franchiseId === undefined) return;
        fetchAll(franchiseId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [franchiseId]);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, franchiseFilter, orderDateFrom, orderDateTo, deliveryDateFrom, deliveryDateTo]);

    // Reset to page 1 when itemsPerPage changes
    useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage]);

    async function fetchAll(currentFranchiseId: string | null | undefined) {
        // Always read from localStorage (source of truth set by AdminLayout)
        // Don't rely on state or param as it might be stale after create
        const finalFranchiseId = typeof window !== 'undefined'
            ? localStorage.getItem('current_franchise_id')
            : null

        // fetch customers, products, drivers and orders
        try {
            const isSuperAdmin = typeof window !== 'undefined'
                ? localStorage.getItem('is_super_admin') === 'true'
                : false
            const currentStaffEmail = typeof window !== 'undefined'
                ? localStorage.getItem('current_staff_email')
                : null

            let customersQuery = supabase.from('customers').select('*');
            let driversQuery = supabase.from('drivers').select('*');
            let ordersQuery = supabase.from('orders').select('*').order('created_at', { ascending: false }).order('id', { ascending: false });

            // Filter based on user role:
            // Super Admin: Show ALL data (no filter)
            // Franchise: Show only data where franchise_id = their franchise_id
            if (isSuperAdmin) {
                // Super admin sees ALL data (no filter applied)
                // Don't apply any filter - show all customers, drivers, and orders
            } else if (finalFranchiseId) {
                // Franchise sees only their own data
                customersQuery = customersQuery.eq('franchise_id', finalFranchiseId);
                driversQuery = driversQuery.eq('franchise_id', finalFranchiseId);
                ordersQuery = ordersQuery.eq('franchise_id', finalFranchiseId);
            } else if (currentStaffEmail) {
                // Staff member (not franchise owner): filter by creator
                customersQuery = customersQuery.eq('created_by_email', currentStaffEmail);
                driversQuery = driversQuery.eq('created_by_email', currentStaffEmail);
                ordersQuery = ordersQuery.eq('created_by_email', currentStaffEmail);
            } else {
                // If no franchise_id found, show empty (shouldn't happen but safety check)
                customersQuery = customersQuery.eq('id', -1); // Impossible condition
                driversQuery = driversQuery.eq('id', -1); // Impossible condition
                ordersQuery = ordersQuery.eq('id', -1); // Impossible condition
            }

            // Fetch companies for logo mapping
            let companiesQuery = supabase.from('company').select('id, company_name, companyLogo');
            if (finalFranchiseId) {
                companiesQuery = companiesQuery.eq('franchise_id', finalFranchiseId);
            }

            const [{ data: custData }, { data: prodData }, { data: drivData }, { data: ordersData }, { data: orderItemsData }, { data: companiesData }] =
                await Promise.all([
                    customersQuery,
                    supabase.from('products').select('*'),
                    driversQuery,
                    ordersQuery,
                    supabase.from('order_items').select('*'),
                    companiesQuery,
                ]);

            // Create a map from company_id to companyLogo
            const logoMap = new Map<string, string>();
            if (companiesData) {
                companiesData.forEach((company: any) => {
                    if (company.id && company.companyLogo) {
                        logoMap.set(company.id, company.companyLogo);
                    }
                });
            }
            setCompanies(companiesData || []);
            setCompanyLogoMap(logoMap);

            setCustomers(custData || []);
            setProducts(prodData || []);
            setDrivers(drivData || []);
            setOrders((ordersData as SupaOrder[]) || []);
            setOrderItems(orderItemsData || []);
        } catch (err) {
            console.error('fetchAll error', err);
        }
    }

    // --- helper: derive display rows (enrich orders) ---
    const enrichedOrders = orders.map((o) => {
        const cust = customers.find((c) => c.id === o.customer_id);
        const drv = drivers.find((d) => d.id === o.driver_id);

        // Get customer details from order.customer_details if customer not found in customers array
        // This is useful when franchise user sees orders from super admin where customer might not be in their filtered list
        let customerCompany = cust?.company_name || '-';
        let contactName = `${cust?.first_name || ''}${cust?.last_name ? ' ' + cust?.last_name : ''}`.trim() || '-';

        if (!cust && (o as any).customer_details) {
            try {
                const customerDetails = typeof (o as any).customer_details === 'string'
                    ? JSON.parse((o as any).customer_details)
                    : (o as any).customer_details;

                if (customerDetails && typeof customerDetails === 'object') {
                    customerCompany = customerDetails.company_name || customerDetails.companyName || '-';
                    const firstName = customerDetails.first_name || customerDetails.firstName || '';
                    const lastName = customerDetails.last_name || customerDetails.lastName || '';
                    contactName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim() || '-';
                }
            } catch (err) {
                console.error('Error parsing customer_details:', err);
            }
        }

        // Calculate total quantity from order_items (or use order.quantity if it exists)
        const itemsForOrder = orderItems.filter((item) => item.order_id === o.id);
        const calculatedQuantity = itemsForOrder.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        // Use order.quantity if it exists (from database), otherwise use calculated from order_items
        const totalQuantity = (o as any).quantity !== undefined && (o as any).quantity !== null
            ? Number((o as any).quantity)
            : calculatedQuantity;

        // Use deliveryStatus if available, otherwise use status field
        const deliveryStatus = (o as any).deliveryStatus || o.status || 'Not Dispatched';

        return {
            ...o,
            customerCompany,
            contactName,
            productTypeDisplay: '-',
            driverName: drv ? drv.driver_name : null,
            deliveryStatus,
            quantity: totalQuantity,
        };
    });

    // --- filter orders based on search term, status filter, franchise filter, and date range ---
    const filteredOrders = enrichedOrders.filter((order) => {
        // Search filter - search in order_name, customer company, PO number, contact name
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            (order.order_name?.toLowerCase().includes(searchLower)) ||
            (order.customerCompany?.toLowerCase().includes(searchLower)) ||
            (order.po_number?.toLowerCase().includes(searchLower)) ||
            (order.contactName?.toLowerCase().includes(searchLower)) ||
            (order.driverName?.toLowerCase().includes(searchLower));

        // Status filter
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            const orderStatus = (order.deliveryStatus || order.status || '').toLowerCase().trim();
            const filterStatus = statusFilter.toLowerCase().trim();

            // Handle different status variations
            if (filterStatus === 'processing') {
                matchesStatus = orderStatus === 'processing';
            } else if (filterStatus === 'pending payment') {
                matchesStatus = orderStatus === 'pending payment' || orderStatus === 'pendingpayment';
            } else if (filterStatus === 'driver assigned') {
                matchesStatus = orderStatus === 'driver assigned' || orderStatus === 'driverassigned';
            } else if (filterStatus === 'in transit') {
                matchesStatus = orderStatus === 'in transit' || orderStatus === 'intransit';
            } else if (filterStatus === 'completed') {
                matchesStatus = orderStatus === 'completed' || orderStatus === 'dispatched';
            } else if (filterStatus === 'cancelled') {
                matchesStatus = orderStatus === 'cancelled' || orderStatus === 'canceled';
            } else if (filterStatus === 'unable to driver') {
                matchesStatus = orderStatus === 'unable to driver' || orderStatus === 'unabletodriver';
            } else {
                // Fallback to exact match
                matchesStatus = orderStatus === filterStatus;
            }
        }

        // Franchise filter (Super Admin only - others already see their own franchise data)
        let matchesFranchise = true;
        if (franchiseFilter !== 'all') {
            const orderFranchiseId = (order as any).franchise_id ?? null;
            matchesFranchise = orderFranchiseId === franchiseFilter;
        }

        // Order date range filter
        let matchesOrderDateRange = true;
        if (orderDateFrom || orderDateTo) {
            if (!order.order_date) {
                matchesOrderDateRange = false;
            } else {
                const orderDate = new Date(order.order_date);
                if (orderDateFrom) {
                    const fromDate = new Date(orderDateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (orderDate < fromDate) {
                        matchesOrderDateRange = false;
                    }
                }
                if (orderDateTo) {
                    const toDate = new Date(orderDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (orderDate > toDate) {
                        matchesOrderDateRange = false;
                    }
                }
            }
        }

        // Delivery date range filter
        let matchesDeliveryDateRange = true;
        if (deliveryDateFrom || deliveryDateTo) {
            if (!order.delivery_date) {
                matchesDeliveryDateRange = false;
            } else {
                const deliveryDate = new Date(order.delivery_date);
                if (deliveryDateFrom) {
                    const fromDate = new Date(deliveryDateFrom);
                    fromDate.setHours(0, 0, 0, 0);
                    if (deliveryDate < fromDate) {
                        matchesDeliveryDateRange = false;
                    }
                }
                if (deliveryDateTo) {
                    const toDate = new Date(deliveryDateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (deliveryDate > toDate) {
                        matchesDeliveryDateRange = false;
                    }
                }
            }
        }

        return (
            matchesSearch &&
            matchesStatus &&
            matchesFranchise &&
            matchesOrderDateRange &&
            matchesDeliveryDateRange
        );
    });

    // Sort orders - prioritize column sort if active, otherwise use dropdown sortBy
    const sortedOrders = [...filteredOrders].sort((a, b) => {
        // If column sort is active, use that
        if (sortColumn) {
            let aValue: any
            let bValue: any

            switch (sortColumn) {
                case 'order_id':
                    aValue = a.order_name || String(a.id)
                    bValue = b.order_name || String(b.id)
                    break
                case 'customer':
                    aValue = a.customerCompany || ''
                    bValue = b.customerCompany || ''
                    break
                case 'po_number':
                    aValue = a.po_number || ''
                    bValue = b.po_number || ''
                    break
                case 'order_date':
                    aValue = a.order_date || ''
                    bValue = b.order_date || ''
                    break
                case 'delivery_date':
                    aValue = a.delivery_date || ''
                    bValue = b.delivery_date || ''
                    break
                case 'delivery_status':
                    aValue = a.deliveryStatus || a.status || ''
                    bValue = b.deliveryStatus || b.status || ''
                    break
                case 'driver':
                    aValue = a.driverName || ''
                    bValue = b.driverName || ''
                    break
                default:
                    return 0
            }

            // Handle date comparison
            if (sortColumn === 'order_date' || sortColumn === 'delivery_date') {
                const dateA = aValue ? new Date(aValue).getTime() : 0
                const dateB = bValue ? new Date(bValue).getTime() : 0
                if (isNaN(dateA) || isNaN(dateB)) return 0
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
            }

            // Handle string comparison
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
                return sortDirection === 'asc' ? comparison : -comparison
            }

            // Handle number comparison (for order_id)
            if (sortColumn === 'order_id') {
                // Extract numeric part from order_name (e.g., "ORD-123456" -> 123456)
                const aNum = aValue.match(/\d+/) ? parseInt(aValue.match(/\d+/)?.[0] || '0') : a.id
                const bNum = bValue.match(/\d+/) ? parseInt(bValue.match(/\d+/)?.[0] || '0') : b.id
                return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
            }

            return 0
        }

        // Otherwise use dropdown sortBy
        let aValue: any
        let bValue: any
        let direction: 'asc' | 'desc' = 'desc'

        switch (sortBy) {
            case 'created_at_latest':
                // Sort by created_at (newest first), fallback to id if created_at is same
                aValue = (a as any).created_at || a.order_date || ''
                bValue = (b as any).created_at || b.order_date || ''
                direction = 'desc'
                // If created_at is same, sort by id (descending)
                if (aValue === bValue && aValue) {
                    return b.id - a.id
                }
                break
            case 'created_at_oldest':
                aValue = (a as any).created_at || a.order_date || ''
                bValue = (b as any).created_at || b.order_date || ''
                direction = 'asc'
                // If created_at is same, sort by id (ascending)
                if (aValue === bValue && aValue) {
                    return a.id - b.id
                }
                break
            case 'delivery_date_latest':
                aValue = a.delivery_date || ''
                bValue = b.delivery_date || ''
                direction = 'desc'
                break
            case 'delivery_date_oldest':
                aValue = a.delivery_date || ''
                bValue = b.delivery_date || ''
                direction = 'asc'
                break
            case 'order_date_latest':
                aValue = a.order_date || ''
                bValue = b.order_date || ''
                direction = 'desc'
                break
            case 'order_date_oldest':
                aValue = a.order_date || ''
                bValue = b.order_date || ''
                direction = 'asc'
                break
            case 'customer_asc':
                aValue = a.customerCompany || ''
                bValue = b.customerCompany || ''
                direction = 'asc'
                break
            case 'customer_desc':
                aValue = a.customerCompany || ''
                bValue = b.customerCompany || ''
                direction = 'desc'
                break
            case 'status_asc':
                aValue = a.deliveryStatus || a.status || ''
                bValue = b.deliveryStatus || b.status || ''
                direction = 'asc'
                break
            case 'status_desc':
                aValue = a.deliveryStatus || a.status || ''
                bValue = b.deliveryStatus || b.status || ''
                direction = 'desc'
                break
            default:
                // Default: sort by created_at (newest first)
                aValue = (a as any).created_at || a.order_date || ''
                bValue = (b as any).created_at || b.order_date || ''
                direction = 'desc'
                if (aValue === bValue && aValue) {
                    return b.id - a.id
                }
        }

        // Handle date comparison
        if (aValue && bValue && (sortBy.includes('date') || sortBy.includes('created_at'))) {
            const dateA = new Date(aValue).getTime()
            const dateB = new Date(bValue).getTime()
            if (isNaN(dateA) || isNaN(dateB)) return 0
            return direction === 'asc' ? dateA - dateB : dateB - dateA
        }

        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
            return direction === 'asc' ? comparison : -comparison
        }

        return 0
    })

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    const handleClearFilters = () => {
        setOrderDateFrom('');
        setOrderDateTo('');
        setDeliveryDateFrom('');
        setDeliveryDateTo('');
        setStatusFilter('all');
        setFranchiseFilter('all');
        setSortBy('created_at_latest');
        setSearchTerm('');
    }

    const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);

    const paginatedOrders = sortedOrders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- file upload helper (logo) ---
    async function uploadLogoFile(file: File) {
        try {
            // Use 'logos' bucket
            const bucketName = 'logos';
            const path = `${Date.now()}-${file.name}`;

            // Verify user is authenticated before storage upload (required for storage RLS policy)
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userData?.user) {
                console.error('Auth error before logo upload:', userErr);
                return null;
            }

            let res = await supabase.storage.from(bucketName).upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

            // If logos bucket doesn't exist, try invoices bucket
            if (res.error && res.error.message?.includes('Bucket not found')) {
                console.warn('Logos bucket not found, trying invoices bucket');
                const fallbackPath = `${Date.now()}-${file.name}`;
                res = await supabase.storage.from('invoices').upload(fallbackPath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

                if (res.error) {
                    console.error('Logo upload error (invoices bucket):', res.error);
                    return null;
                }

                const publicUrl = supabase.storage.from('invoices').getPublicUrl(res.data.path).data?.publicUrl || null;
                return publicUrl;
            }

            if (res.error) {
                console.error('Logo upload error:', res.error);
                return null;
            }

            const publicUrl = supabase.storage.from(bucketName).getPublicUrl(res.data.path).data?.publicUrl || null;
            return publicUrl;
        } catch (err) {
            console.error('uploadLogoFile error', err);
            return null;
        }
    }

    // --- validation function ---
    const validateOrderForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!newOrder.customerId || newOrder.customerId.trim() === '') {
            errors.customerId = 'Customer is required';
        }

        if (!newOrder.quantity || Number(newOrder.quantity) <= 0) {
            errors.quantity = 'Number of cases is required and must be greater than 0';
        }

        if (!newOrder.deliveryDate || newOrder.deliveryDate.trim() === '') {
            errors.deliveryDate = 'Delivery date is required';
        }

        if (!newOrder.deliveryAddress || newOrder.deliveryAddress.trim() === '') {
            errors.deliveryAddress = 'Delivery address is required';
        }

        if (!newOrder.deliveryStatus || newOrder.deliveryStatus.trim() === '') {
            errors.deliveryStatus = 'Delivery status is required';
        }

        setOrderErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // --- place order (insert into orders and order_items) ---
    async function handlePlaceOrder() {
        if (!validateOrderForm()) {
            return;
        }

        setLoadingPlaceOrder(true);

        try {
            // upload logo if base64 preview exists as file input earlier
            let logoUrl = null;
            if (newOrder.customerLogo && typeof newOrder.customerLogo !== 'string') {
                // if it's a File object (but in our UI it's base64 preview), we handle file upload via input change
            }

            // if customerLogoPreview contains a data URL (base64), we can convert it to blob and upload
            if (customerLogoPreview && customerLogoPreview.startsWith('data:')) {
                try {
                    const res = await fetch(customerLogoPreview);
                    const blob = await res.blob();
                    const file = new File([blob], `logo-${Date.now()}.png`, { type: blob.type });
                    logoUrl = await uploadLogoFile(file);
                    if (!logoUrl) {
                        console.warn('Logo upload failed, continuing without logo');
                    }
                } catch (err) {
                    console.error('Error converting logo preview to file:', err);
                    // Continue without logo
                }
            }

            // generate an order_name like ORD-<timestamp>
            const orderName = `ORD-${Date.now().toString().slice(-6)}`;

            // Always read from localStorage (source of truth set by AdminLayout)
            const currentFranchiseId = typeof window !== 'undefined'
                ? localStorage.getItem('current_franchise_id')
                : null;

            // Map deliveryStatus to valid database status values (to satisfy orders_status_check constraint)
            // Valid database status values: pending, Processing, Confirmed, Completed, Cancelled
            const statusMap: Record<string, string> = {
                'processing': 'Processing',
                'pendingPayment': 'pending',
                'driverAssigned': 'Processing',
                'inTransit': 'Processing',
                'completed': 'Completed',
                'cancelled': 'Cancelled',
                'unableToDriver': 'Cancelled',
            };
            const mappedStatus = newOrder.deliveryStatus
                ? (statusMap[newOrder.deliveryStatus] || 'pending')
                : 'pending';

            // Fetch customer details to save in customer_details
            let customerDetails = null;
            if (newOrder.customerId) {
                const selectedCustomer = customers.find((c) => c.id === Number(newOrder.customerId));
                if (selectedCustomer) {
                    // Get delivery_zone_name - explicitly access from customer object
                    const deliveryZoneName = (selectedCustomer as any).delivery_zone_name || null;

                    customerDetails = {
                        id: selectedCustomer.id,
                        company_name: selectedCustomer.company_name || null,
                        first_name: selectedCustomer.first_name || null,
                        last_name: selectedCustomer.last_name || null,
                        email: selectedCustomer.email || null,
                        phone: selectedCustomer.phone || null,
                        alternateEmail1: selectedCustomer.alternateEmail1 || null,
                        alternateEmail2: selectedCustomer.alternateEmail2 || null,
                        alternatePhone: selectedCustomer.alternatePhone || null,
                        zoneCity: selectedCustomer.zoneCity || null,
                        delivery_address: selectedCustomer.delivery_address || null,
                        company_logo: selectedCustomer.company_logo || null,
                        custom_price_per_unit: selectedCustomer.custom_price_per_unit || null,
                        delivery_zone: selectedCustomer.delivery_zone || null,
                        delivery_zone_name: deliveryZoneName,
                        industry: selectedCustomer.industry || null,
                        status: selectedCustomer.status || null,
                    };
                }
            }

            // Get selected driver details
            const selectedDriver = drivers.find((d) => d.id === Number(newOrder.driverId));
            const driverName = selectedDriver?.driver_name || null;
            const driverNumber = selectedDriver?.phone_number || null;
            const driverEmail = selectedDriver?.email || null;

            // prepare order payload - using form keys only
            const now = new Date().toISOString();
            const orderPayload: any = {
                order_name: orderName,
                special_event_logo: logoUrl,
                customer_id: newOrder.customerId || null,
                customer_details: customerDetails, // Customer details as object
                po_number: newOrder.poNumber || null,
                order_date: now,
                delivery_date: newOrder.deliveryDate || null,
                delivery_address: newOrder.deliveryAddress || null,
                status: mappedStatus, // Mapped status for database constraint
                deliveryStatus: newOrder.deliveryStatus || null, // Original delivery status for display
                driver_id: newOrder.driverId ? Number(newOrder.driverId) : null,
                driver_name: driverName,
                driver_number: driverNumber,
                driver_email: driverEmail,
                special_instructions: newOrder.specialInstructions || null,
                quantity: Number(newOrder.quantity) || 1, // Number of cases
                franchise_id: currentFranchiseId || null,
                created_at: now,
                status_change_count: 1, // New orders start with count 1
            };

            // insert order
            // Get current identifiers for creator tracking
            const isSuperAdmin = typeof window !== 'undefined'
                ? localStorage.getItem('is_super_admin') === 'true'
                : false
            const currentStaffEmail = typeof window !== 'undefined'
                ? localStorage.getItem('current_staff_email')
                : null

            // Add created_by_email to order payload
            const orderPayloadWithCreator = {
                ...orderPayload,
                created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
                franchise_id: isSuperAdmin ? null : (orderPayload.franchise_id || null),
            }

            const { data: insertedOrders, error: insertErr } = await supabase.from('orders').insert(orderPayloadWithCreator).select().limit(1);
            if (insertErr) {
                console.error('orders insert error', insertErr);
                setLoadingPlaceOrder(false);
                return;
            }

            const insertedOrder = insertedOrders?.[0];
            if (!insertedOrder) {
                setLoadingPlaceOrder(false);
                return;
            }

            // refresh quick: prepend new order into UI (no full refetch required)
            setOrders((prev) => [insertedOrder as SupaOrder, ...prev]);

            // reset form + close modal
            setNewOrder({
                customerId: '',
                productType: '',
                quantity: '',
                deliveryDate: '',
                deliveryAddress: '',
                driverId: '',
                paymentStatus: '',
                deliveryStatus: '',
                poNumber: '',
                specialInstructions: '',
                customerLogo: '',
                paymentMethod: '',
            });
            setSelectedDriver('');
            setOrderErrors({});
            setCustomerLogoPreview(null);
            setIsPlaceOrderDialogOpen(false);
        } catch (err) {
            console.error('handlePlaceOrder error', err);
        } finally {
            setLoadingPlaceOrder(false);
        }
    }

    // --- assign driver to an existing order (update orders.delivery_driver) ---
    async function handleAssignDriver() {
        if (!selectedDriverForAssignment || !selectedOrderForDriver) return;
        setLoadingAssign(true);
        try {
            // Get selected driver details
            const selectedDriver = drivers.find((d) => d.id === Number(selectedDriverForAssignment));
            const driverName = selectedDriver?.driver_name || null;
            const driverNumber = selectedDriver?.phone_number || null;
            const driverEmail = selectedDriver?.email || null;

            // update DB - Get current order to check status_change_count
            const orderId = selectedOrderForDriver;
            const { data: currentOrder } = await supabase
                .from('orders')
                .select('deliveryStatus, status_change_count')
                .eq('order_name', orderId)
                .maybeSingle();

            const currentCount = currentOrder?.status_change_count || 0;
            const oldStatus = (currentOrder?.deliveryStatus || '').toLowerCase();
            const newCount = oldStatus !== 'driver assigned' ? currentCount + 1 : currentCount;

            const { error: updErr } = await supabase.from('orders').update({
                driver_id: Number(selectedDriverForAssignment),
                driver_name: driverName,
                driver_number: driverNumber,
                driver_email: driverEmail,
                deliveryStatus: 'driver assigned',
                status_change_count: newCount,
            }).eq('order_name', orderId);
            if (updErr) {
                console.error('assign driver update error', updErr);
                setLoadingAssign(false);
                return;
            }

            // Send email to customer (same as OrderForm when driver assigned)
            const ord = orders.find((o) => String(o.order_name) === orderId);
            const cust = ord?.customer_id ? customers.find((c) => c.id === ord.customer_id) : null;
            let customerEmail = cust?.email || null;
            let customerName = cust ? (cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Customer') : 'Customer';
            if (!customerEmail && ord && (ord as any).customer_details) {
                try {
                    const details = typeof (ord as any).customer_details === 'string'
                        ? JSON.parse((ord as any).customer_details) : (ord as any).customer_details;
                    if (details?.email) customerEmail = details.email;
                    if (details?.company_name) customerName = details.company_name;
                } catch (_) { }
            }
            if (customerEmail) {
                try {
                    await supabase.functions.invoke('send_order_email', {
                        body: JSON.stringify({
                            to: customerEmail,
                            customer_name: customerName,
                            order_name: orderId,
                            order_id: orderId,
                            delivery_status: 'driver assigned',
                            quantity: (ord as any)?.quantity ?? 1,
                            previous_status: oldStatus || null,
                            email_type: 'status_updated',
                        }),
                    });
                } catch (emailErr: any) {
                    console.error('Error sending driver-assigned email:', emailErr);
                }
            }

            // update UI (quick)
            setOrders((prev) =>
                prev.map((o) =>
                    String(o.order_name) === orderId ? {
                        ...o,
                        driver_id: Number(selectedDriverForAssignment),
                        driver_name: driverName,
                        driver_number: driverNumber,
                        driver_email: driverEmail,
                        deliveryStatus: 'driver assigned',
                    } : o
                )
            );

            setIsAssignDriverDialogOpen(false);
            setSelectedOrderForDriver(null);
            setSelectedDriverForAssignment('');
        } catch (err) {
            console.error('handleAssignDriver error', err);
        } finally {
            setLoadingAssign(false);
        }
    }

    // --- Helper function to convert camelCase status to lowercase with spaces ---
    const convertStatusToDatabaseFormat = (status: string): string => {
        if (!status) return ''
        // Map camelCase form values to database format
        const statusMap: Record<string, string> = {
            'processing': 'processing',
            'pendingPayment': 'pending payment',
            'driverAssigned': 'driver assigned',
            'inTransit': 'in transit',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'unableToDriver': 'unable to driver',
        }
        // If it's already in database format, return as is (lowercase)
        if (statusMap[status]) {
            return statusMap[status]
        }
        // Otherwise convert to lowercase
        return status.toLowerCase()
    }

    // --- Send FCM notification to driver and customer ---
    const sendFCMNotification = async (tokens: string[], title: string, message: string) => {
        try {
            if (!tokens || tokens.length === 0) {
                console.warn('⚠️ No FCM tokens found. Push notifications will not be sent.')
                return { success: false, error: 'No FCM tokens found' }
            }

            const validTokens = tokens.filter(token => token && token.trim() !== '')

            if (validTokens.length === 0) {
                console.warn('⚠️ No valid FCM tokens found.')
                return { success: false, error: 'No valid FCM tokens found' }
            }

            console.log(`✅ Sending FCM notification to ${validTokens.length} device(s)`)

            const { data: result, error: functionError } = await supabase.functions.invoke('send-fcm-notification', {
                body: {
                    tokens: validTokens,
                    title: title,
                    message: message,
                },
            })

            if (functionError) {
                console.error('❌ FCM Edge Function Error:', functionError)
                throw new Error(functionError.message || 'Failed to send FCM notification')
            }

            if (!result || !result.success) {
                const errorMsg = result?.error || 'Unknown error occurred'
                console.error('❌ FCM Edge Function returned error:', errorMsg)
                throw new Error(errorMsg)
            }

            console.log('✅ FCM Notification Response:', result)
            return { success: true, result }
        } catch (error) {
            console.error('❌ Error sending FCM notification:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }

    // --- Send notification to driver and customer when order status changes ---
    const sendStatusChangeNotification = async (order: any, newStatus: string) => {
        try {
            const tokens: string[] = []
            const recipientIds: number[] = []
            const notificationTitle = `Order ${order.order_name} Status Updated`
            // Format status for display (capitalize first letter of each word)
            const formattedStatus = newStatus
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
            let notificationMessage = `Your order ${order.order_name} status has been updated to ${formattedStatus}.`

            // Fetch customer FCM token (only for allowed statuses)
            const allowedCustomerStatuses = ['pending', 'completed', 'cancelled', 'driver assigned']
            if (order.customer_id && allowedCustomerStatuses.includes(newStatus.toLowerCase())) {
                const { data: customerData, error: customerError } = await supabase
                    .from('customers')
                    .select('fcm_token, company_name, first_name, last_name')
                    .eq('id', order.customer_id)
                    .maybeSingle()

                if (!customerError && customerData && customerData.fcm_token) {
                    tokens.push(customerData.fcm_token)
                    recipientIds.push(order.customer_id)
                    console.log(`📱 Found customer FCM token for order ${order.order_name}`)
                }
            }

            // Fetch driver FCM token
            if (order.driver_id) {
                console.log('order.driver_id', order.driver_id)
                const { data: driverData, error: driverError } = await supabase
                    .from('drivers')
                    .select('fcm_token, driver_name')
                    .eq('id', order.driver_id)
                    .maybeSingle()

                if (!driverError && driverData && driverData.fcm_token) {
                    tokens.push(driverData.fcm_token)
                    recipientIds.push(order.driver_id)
                    console.log(`🚗 Found driver FCM token for order ${order.order_name}`)
                }
            }

            // Send notification if tokens found
            if (tokens.length > 0) {
                await sendFCMNotification(tokens, notificationTitle, notificationMessage)
                console.log(`✅ Status change notification sent to ${tokens.length} recipient(s)`)
            } else {
                console.log('ℹ️ No FCM tokens found for driver or customer')
            }

            // Save notification to database
            const currentFranchiseId = typeof window !== 'undefined'
                ? localStorage.getItem('current_franchise_id')
                : null;
            const isSuperAdmin = typeof window !== 'undefined'
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;

            const notificationData: any = {
                title: notificationTitle,
                message: notificationMessage,
                recipient_type: 'order_status_update',
                recipient_count: recipientIds.length,
                status: 'sent',
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                recipient_ids: recipientIds.length > 0 ? recipientIds : null,
                franchise_id: !isSuperAdmin && currentFranchiseId ? currentFranchiseId : null,
                order_id: order.id,
                order_name: order.order_name
            }

            const { error: notifError } = await supabase
                .from('notifications')
                .insert([notificationData])

            if (notifError) {
                console.error('Error saving notification to database:', notifError)
            } else {
                console.log('✅ Notification saved to database')
            }
        } catch (error) {
            console.error('Error sending status change notification:', error)
            // Don't block status update if notification fails
        }
    }

    // --- bulk assign driver to multiple orders ---
    async function handleBulkAssignDriver() {
        if (!selectedDriverForBulkAssignment || selectedOrders.size === 0) return;
        setLoadingBulkAssign(true);
        try {
            // Get selected driver details
            const selectedDriver = drivers.find((d) => d.id === Number(selectedDriverForBulkAssignment));
            const driverName = selectedDriver?.driver_name || null;
            const driverNumber = selectedDriver?.phone_number || null;
            const driverEmail = selectedDriver?.email || null;

            // Get order IDs from selected orders
            const orderIds = Array.from(selectedOrders);

            // Get current orders to check status_change_count
            const { data: currentOrders } = await supabase
                .from('orders')
                .select('id, deliveryStatus, status_change_count')
                .in('id', orderIds);

            // Update all selected orders with incremented status_change_count
            const updatePromises = (currentOrders || []).map(order => {
                const currentCount = order.status_change_count || 0;
                const oldStatus = (order.deliveryStatus || '').toLowerCase();
                const newCount = oldStatus !== 'driver assigned' ? currentCount + 1 : currentCount;

                return supabase.from('orders').update({
                    driver_id: Number(selectedDriverForBulkAssignment),
                    driver_name: driverName,
                    driver_number: driverNumber,
                    driver_email: driverEmail,
                    deliveryStatus: 'driver assigned',
                    status_change_count: newCount,
                }).eq('id', order.id);
            });

            const results = await Promise.all(updatePromises);
            const updErr = results.find(r => r.error)?.error;

            if (updErr) {
                console.error('bulk assign driver update error', updErr);
                setLoadingBulkAssign(false);
                return;
            }

            // Send email to each order's customer (same as OrderForm when driver assigned)
            for (const orderId of orderIds) {
                const ord = orders.find((o) => o.id === orderId);
                const cust = ord?.customer_id ? customers.find((c) => c.id === ord.customer_id) : null;
                let customerEmail = cust?.email || null;
                let customerName = cust ? (cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Customer') : 'Customer';
                if (!customerEmail && ord && (ord as any).customer_details) {
                    try {
                        const details = typeof (ord as any).customer_details === 'string'
                            ? JSON.parse((ord as any).customer_details) : (ord as any).customer_details;
                        if (details?.email) customerEmail = details.email;
                        if (details?.company_name) customerName = details.company_name;
                    } catch (_) { }
                }
                if (customerEmail) {
                    try {
                        await supabase.functions.invoke('send_order_email', {
                            body: JSON.stringify({
                                to: customerEmail,
                                customer_name: customerName,
                                order_name: (ord as any)?.order_name || `#${orderId}`,
                                order_id: (ord as any)?.order_name || String(orderId),
                                delivery_status: 'driver assigned',
                                quantity: (ord as any)?.quantity ?? 1,
                                previous_status: (ord as any)?.deliveryStatus || (ord as any)?.status || null,
                                email_type: 'status_updated',
                            }),
                        });
                    } catch (emailErr: any) {
                        console.error('Error sending driver-assigned email for order', orderId, emailErr);
                    }
                }
            }

            // Update UI
            setOrders((prev) =>
                prev.map((o) =>
                    selectedOrders.has(o.id) ? {
                        ...o,
                        driver_id: Number(selectedDriverForBulkAssignment),
                        driver_name: driverName,
                        driver_number: driverNumber,
                        driver_email: driverEmail,
                        deliveryStatus: 'driver assigned',
                    } : o
                )
            );

            // Refresh data
            const currentFranchiseId = typeof window !== 'undefined'
                ? localStorage.getItem('current_franchise_id')
                : null;
            await fetchAll(currentFranchiseId);

            setIsBulkAssignDriverDialogOpen(false);
            setSelectedOrders(new Set());
            setSelectedDriverForBulkAssignment('');
        } catch (err) {
            console.error('handleBulkAssignDriver error', err);
        } finally {
            setLoadingBulkAssign(false);
        }
    }

    // --- helper functions for checkbox selection ---
    const handleSelectOrder = (orderId: number) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedOrders.size === paginatedOrders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(paginatedOrders.map(o => o.id)));
        }
    };

    // --- file input handler for place order modal ---
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setCustomerLogoPreview(result);
            setNewOrder((n) => ({ ...n, customerLogo: result }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setCustomerLogoPreview(null);
        setNewOrder((n) => ({ ...n, customerLogo: '' }));
    };

    // open assign dialog helper
    const openAssignDriverDialog = (orderName: string) => {
        setSelectedOrderForDriver(orderName);
        setSelectedDriverForAssignment('');
        setIsAssignDriverDialogOpen(true);
    };

    // open edit dialog helper
    const handleOpenEdit = async (orderId: string) => {
        setEditingOrderId(orderId || '');
        setIsEditOrderDialogOpen(true);

        try {
            // Try by order_name first
            let orderRes = await supabase
                .from('orders')
                .select('*')
                .eq('order_name', orderId)
                .limit(1);

            if (!orderRes.data || orderRes.data.length === 0) {
                // Fallback: try by numeric id
                const idNum = Number(orderId);
                if (!Number.isNaN(idNum)) {
                    orderRes = await supabase.from('orders').select('*').eq('id', idNum).limit(1);
                }
            }

            const order = orderRes.data?.[0];
            if (!order) {
                alert('Order not found');
                setIsEditOrderDialogOpen(false);
                return;
            }

            // Format delivery date for input
            const deliveryDate = order.delivery_date
                ? new Date(order.delivery_date).toISOString().split('T')[0]
                : '';

            setNewOrder({
                customerId: order.customer_id ? String(order.customer_id) : '',
                productType: 'Case',
                quantity: order.quantity ? String(order.quantity) : '',
                deliveryDate: deliveryDate,
                deliveryAddress: order.delivery_address || '',
                driverId: order.driver_id ? String(order.driver_id) : '',
                paymentStatus: '',
                deliveryStatus: order.deliveryStatus || order.status || 'Processing',
                poNumber: order.po_number || '',
                specialInstructions: order.special_instructions || '',
                customerLogo: order.special_event_logo || '',
                paymentMethod: '',
            });

            if (order.special_event_logo) {
                setCustomerLogoPreview(order.special_event_logo);
            } else {
                setCustomerLogoPreview(null);
            }
        } catch (err) {
            console.error('Error fetching order:', err);
            alert('Failed to load order');
            setIsEditOrderDialogOpen(false);
        }
    };

    // handle edit order
    async function handleEditOrder() {
        if (!validateOrderForm() || !editingOrderId) {
            return;
        }

        setLoadingEditOrder(true);

        try {
            let logoUrl: string | null = newOrder.customerLogo || null; // Keep existing logo by default
            if (customerLogoPreview && customerLogoPreview.startsWith('data:')) {
                // New logo uploaded
                try {
                    const res = await fetch(customerLogoPreview);
                    const blob = await res.blob();
                    const file = new File([blob], `logo-${Date.now()}.png`, { type: blob.type });
                    logoUrl = await uploadLogoFile(file) || logoUrl;
                } catch (err) {
                    console.error('Error converting logo preview to file:', err);
                }
            } else if (!customerLogoPreview && newOrder.customerLogo) {
                // Logo was removed
                logoUrl = null;
            }

            const selectedCustomer = customers.find((c) => c.id === Number(newOrder.customerId));
            // Get delivery_zone_name - explicitly access from customer object
            const deliveryZoneName = selectedCustomer ? ((selectedCustomer as any).delivery_zone_name || null) : null;

            const customerDetails = selectedCustomer ? {
                id: selectedCustomer.id,
                company_name: selectedCustomer.company_name || null,
                first_name: selectedCustomer.first_name || null,
                last_name: selectedCustomer.last_name || null,
                email: selectedCustomer.email || null,
                phone: selectedCustomer.phone || null,
                alternateEmail1: selectedCustomer.alternateEmail1 || null,
                alternateEmail2: selectedCustomer.alternateEmail2 || null,
                alternatePhone: selectedCustomer.alternatePhone || null,
                zoneCity: selectedCustomer.zoneCity || null,
                delivery_address: selectedCustomer.delivery_address || null,
                company_logo: selectedCustomer.company_logo || null,
                custom_price_per_unit: selectedCustomer.custom_price_per_unit || null,
                delivery_zone: selectedCustomer.delivery_zone || null,
                delivery_zone_name: deliveryZoneName,
                industry: selectedCustomer.industry || null,
                status: selectedCustomer.status || null,
            } : null;

            // Get selected driver details
            const selectedDriver = drivers.find((d) => d.id === Number(newOrder.driverId));
            const driverName = selectedDriver?.driver_name || null;
            const driverNumber = selectedDriver?.phone_number || null;
            const driverEmail = selectedDriver?.email || null;

            const statusMap: Record<string, string> = {
                'processing': 'Processing',
                'pendingPayment': 'pending',
                'driverAssigned': 'Processing',
                'inTransit': 'Processing',
                'completed': 'Completed',
                'cancelled': 'Cancelled',
                'unableToDriver': 'Cancelled',
            };
            const mappedStatus = statusMap[newOrder.deliveryStatus] || 'pending';

            // Convert deliveryStatus from form format (camelCase) to database format (lowercase with spaces)
            const deliveryStatusDbFormat = newOrder.deliveryStatus
                ? convertStatusToDatabaseFormat(newOrder.deliveryStatus)
                : null;

            const updatePayload: any = {
                special_event_logo: logoUrl,
                customer_id: newOrder.customerId || null,
                customer_details: customerDetails,
                po_number: newOrder.poNumber || null,
                delivery_date: newOrder.deliveryDate || null,
                delivery_address: newOrder.deliveryAddress || null,
                status: mappedStatus,
                deliveryStatus: deliveryStatusDbFormat,
                special_instructions: newOrder.specialInstructions || null,
                quantity: Number(newOrder.quantity) || 1,
                driver_id: newOrder.driverId ? Number(newOrder.driverId) : null,
                driver_name: driverName,
                driver_number: driverNumber,
                driver_email: driverEmail,
            };

            // Get order details BEFORE updating to check if status changed
            let orderBeforeUpdate: any = null;
            if (editingOrderId.match(/^ORD-/)) {
                const { data: orderData } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('order_name', editingOrderId)
                    .maybeSingle();
                orderBeforeUpdate = orderData;
            } else {
                const idNum = Number(editingOrderId);
                if (!Number.isNaN(idNum)) {
                    const { data: orderData } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', idNum)
                        .maybeSingle();
                    orderBeforeUpdate = orderData;
                }
            }

            // Check if status changed and increment status_change_count
            if (orderBeforeUpdate) {
                const oldStatus = (orderBeforeUpdate.deliveryStatus || orderBeforeUpdate.status || '').toLowerCase();
                const newStatus = (deliveryStatusDbFormat || '').toLowerCase();
                const currentCount = orderBeforeUpdate.status_change_count || 0;
                const newCount = oldStatus !== newStatus ? currentCount + 1 : currentCount;
                updatePayload.status_change_count = newCount;
            }

            // Update by order_name or id
            let updateQuery = supabase.from('orders').update(updatePayload);
            if (editingOrderId.match(/^ORD-/)) {
                updateQuery = updateQuery.eq('order_name', editingOrderId);
            } else {
                const idNum = Number(editingOrderId);
                if (!Number.isNaN(idNum)) {
                    updateQuery = updateQuery.eq('id', idNum);
                }
            }

            const { error } = await updateQuery;
            if (error) throw error;

            // Check if status changed and send notification
            if (orderBeforeUpdate && newOrder.deliveryStatus) {
                const oldStatus = (orderBeforeUpdate.deliveryStatus || orderBeforeUpdate.status || '').toLowerCase().trim();
                // Convert form value (camelCase) to database format (lowercase with spaces)
                const newStatusDbFormat = convertStatusToDatabaseFormat(newOrder.deliveryStatus);

                // Send notification if status changed
                if (oldStatus !== newStatusDbFormat) {
                    // Use updated order with new status for notification
                    const updatedOrder = { ...orderBeforeUpdate, deliveryStatus: newStatusDbFormat };
                    await sendStatusChangeNotification(updatedOrder, newStatusDbFormat);
                }
            }

            // Refresh orders
            const currentFranchiseId = typeof window !== 'undefined'
                ? localStorage.getItem('current_franchise_id')
                : null;
            await fetchAll(currentFranchiseId);

            // Reset form and close dialog
            setNewOrder({
                customerId: '',
                productType: '',
                quantity: '',
                deliveryDate: '',
                deliveryAddress: '',
                driverId: '',
                paymentStatus: '',
                deliveryStatus: '',
                poNumber: '',
                specialInstructions: '',
                customerLogo: '',
                paymentMethod: '',
            });
            setSelectedDriver('');
            setOrderErrors({});
            setCustomerLogoPreview(null);
            setEditingOrderId('');
            setIsEditOrderDialogOpen(false);
        } catch (err) {
            console.error('handleEditOrder error', err);
            alert('Failed to update order. Please try again.');
        } finally {
            setLoadingEditOrder(false);
        }
    }

    // pick displayed lists for command popover (customers)
    const customerListForUI = customers.map((c) => ({ id: c.id, label: `${c.company_name} — ${c.first_name || ''} ${c.last_name || ''}` }));

    // ---------- UI render (keeps exactly your original layout) ----------
    if (selectedOrderId) {
        return <OrderDetailsView
            orderId={selectedOrderId}
            onBack={() => {
                setSelectedOrderId(null);
                // Refresh orders data when coming back from details view
                const currentFranchiseId = typeof window !== 'undefined'
                    ? localStorage.getItem('current_franchise_id')
                    : null;
                fetchAll(currentFranchiseId);
            }}
        />;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl mb-2">Order Management</h1>
            </div>

            {/* Actions Bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex-1 max-w-md relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input placeholder="Search orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                                className="flex items-center gap-2"
                            >
                                <Filter className="w-4 h-4" />
                                Advanced Filters
                                <ChevronUp className={`w-4 h-4 transition-transform ${isAdvancedFiltersOpen ? '' : 'rotate-180'}`} />
                            </Button>
                        </div>
                        <Button className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold" onClick={() => router.push('/admin/orders/new')}>Place Order for Customer</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Advanced Filters Section */}
            {isAdvancedFiltersOpen && (
                <Card className="border-blue-200">
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            {/* Date Range Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Order Date Range */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-500" />
                                        <Label className="text-sm font-medium">Order Date Range</Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Input
                                                type="date"
                                                placeholder="mm/dd/yyyy"
                                                value={orderDateFrom}
                                                onChange={(e) => setOrderDateFrom(e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                type="date"
                                                placeholder="mm/dd/yyyy"
                                                value={orderDateTo}
                                                onChange={(e) => setOrderDateTo(e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Delivery Date Range */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-500" />
                                        <Label className="text-sm font-medium">Delivery Date Range</Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Input
                                                type="date"
                                                placeholder="mm/dd/yyyy"
                                                value={deliveryDateFrom}
                                                onChange={(e) => setDeliveryDateFrom(e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Input
                                                type="date"
                                                placeholder="mm/dd/yyyy"
                                                value={deliveryDateTo}
                                                onChange={(e) => setDeliveryDateTo(e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Status, Franchise, Sort By, and Clear Filters */}
                            <div className="grid grid-cols-4 md:grid-cols-4 gap-4">
                                {/* Status */}
                                <div>
                                    <Label className="text-sm font-medium">Status</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="processing">Processing</SelectItem> 
                                            <SelectItem value="driver assigned">Driver Assigned</SelectItem>
                                            <SelectItem value="dispatched">Dispatched</SelectItem>
                                            <SelectItem value="in transit">In Transit</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="undelivered">Undelivered</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>


                                </div>
                                {isSuperAdmin && (
                                    <div className="">
                                        <Label className="text-sm font-medium">Franchise</Label>
                                        <Select
                                            value={franchiseFilter}
                                            onValueChange={setFranchiseFilter}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Franchises" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Franchises</SelectItem>
                                                {franchises.map((franchise) => (
                                                    <SelectItem
                                                        key={franchise.id}
                                                        value={String(franchise.id)}
                                                    >
                                                        {franchise.franchise_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Sort By */}
                                <div >
                                    <Label className="text-sm font-medium">Sort By</Label>
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sort By" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="created_at_latest">Created Date (Latest)</SelectItem>
                                            <SelectItem value="created_at_oldest">Created Date (Oldest)</SelectItem>
                                            <SelectItem value="delivery_date_latest">Delivery Date (Latest)</SelectItem>
                                            <SelectItem value="delivery_date_oldest">Delivery Date (Oldest)</SelectItem>
                                            <SelectItem value="order_date_latest">Order Date (Latest)</SelectItem>
                                            <SelectItem value="order_date_oldest">Order Date (Oldest)</SelectItem>
                                            <SelectItem value="customer_asc">Customer (A-Z)</SelectItem>
                                            <SelectItem value="customer_desc">Customer (Z-A)</SelectItem>
                                            <SelectItem value="status_asc">Status (A-Z)</SelectItem>
                                            <SelectItem value="status_desc">Status (Z-A)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Clear Filters */}
                                {(orderDateFrom ||
                                    orderDateTo ||
                                    deliveryDateFrom ||
                                    deliveryDateTo ||
                                    statusFilter !== 'all' ||
                                    franchiseFilter !== 'all' ||
                                    sortBy !== 'created_at_latest') && (
                                        <div className="flex items-end">
                                            <Button
                                                variant="outline"
                                                onClick={handleClearFilters}
                                                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all duration-200 font-medium"
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Clear All Filters
                                            </Button>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bulk Actions Bar */}
            {selectedOrders.size > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-gray-900">
                                    {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
                                </span>
                                <button
                                    onClick={() => setSelectedOrders(new Set())}
                                    className="text-blue-600 hover:text-blue-700 text-sm"
                                >
                                    Clear Selection
                                </button>
                            </div>
                            <Button
                                onClick={() => setIsBulkAssignDriverDialogOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                            >
                                <UserPlus className="h-4 w-4" />
                                Assign Driver to {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                        <colgroup>
                            <col style={{ width: '4%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedOrders.size === paginatedOrders.length && paginatedOrders.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('order_id')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">Order ID</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'order_id' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('order_date')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">Order Date</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'order_date' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>
                                <TableHead>Logo</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('customer')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">Customer</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'customer' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('po_number')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">PO Number</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'po_number' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>


                                {/* <TableHead 
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('order_status')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">Order Status</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'order_status' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead> */}
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('delivery_status')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap"> Status</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'delivery_status' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('driver')}
                                >
                                    <div className="flex items-center relative pr-4">
                                        <span className="whitespace-nowrap">Driver</span>
                                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                                            {sortColumn === 'driver' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </span>
                                    </div>
                                </TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="text-center p-6 text-slate-500">No orders found.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.has(order.id)}
                                                onChange={() => handleSelectOrder(order.id)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-sm truncate cursor-pointer text-sky-600" onClick={() => setSelectedOrderId(String(order.order_name || order.id))}>{order.order_name || `#${order.id}`}</TableCell>
                                        <TableCell className="text-sm truncate">{order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                const cust = customers.find((c) => c.id === order.customer_id);
                                                const companyLogo = cust?.company_id ? companyLogoMap.get(cust.company_id) : null;
                                                const logoUrl = (order as any).special_event_logo || order.logo || companyLogo;

                                                return logoUrl ? (
                                                    <div className="w-12 h-12 rounded-md overflow-hidden border border-slate-200">
                                                        <img src={logoUrl} alt={`${order.customerCompany} logo`} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200">
                                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="overflow-hidden">
                                            <div>
                                                <div className="text-sm truncate">{order.customerCompany}</div>
                                                <div className="text-xs text-slate-500 truncate">{order.contactName}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm truncate">{typeof order.quantity === 'number' ? order.quantity : (order.quantity || '-')} Cases</TableCell>
                                        <TableCell className="text-sm truncate">{order.po_number || '-'}</TableCell>
                                        {/* <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${orderStatusColors[order.status || 'pending'] || 'bg-slate-100 text-slate-800'}`}>
                                                {getDisplayStatus(order.status)}
                                            </span>
                                        </TableCell> */}
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${deliveryStatusColors[order.deliveryStatus] || 'bg-slate-100 text-slate-800'}`}>
                                                {getDisplayDeliveryStatus(order.deliveryStatus)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm truncate">{order.driverName || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedOrderId(String(order.order_name || order.id))}
                                                    className="text-blue-600 bg-blue-100 hover:text-blue-700 hover:bg-blue-50"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(`/admin/orders/${order.order_name || order.id}/edit`)}
                                                    className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                {!order.driverName && (order.deliveryStatus === 'pending' || order.deliveryStatus === 'processing') && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openAssignDriverDialog(String(order.order_name || order.id))}
                                                        className="text-cyan-600 bg-cyan-100 hover:text-cyan-700 hover:bg-cyan-50"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    {/* Pagination Controls */}
                    {sortedOrders.length > 0 && (
                        <div className="flex justify-between items-center px-6 py-4 border-t">
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-gray-600">
                                    Showing {(currentPage - 1) * itemsPerPage + 1}–
                                    {Math.min(currentPage * itemsPerPage, sortedOrders.length)} of {sortedOrders.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="itemsPerPage" className="text-sm text-gray-600 whitespace-nowrap">
                                        View:
                                    </Label>
                                    <Select
                                        value={itemsPerPage.toString()}
                                        onValueChange={(value) => setItemsPerPage(Number(value))}
                                    >
                                        <SelectTrigger id="itemsPerPage" className="w-20 h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1.5 rounded-md border text-sm ${currentPage === 1
                                        ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                        : 'text-gray-700 bg-white hover:bg-gray-100'
                                        }`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage((p) => (p * itemsPerPage < sortedOrders.length ? p + 1 : p))}
                                    disabled={currentPage * itemsPerPage >= sortedOrders.length}
                                    className={`px-3 py-1.5 rounded-md border text-sm ${currentPage * itemsPerPage >= sortedOrders.length
                                        ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                        : 'text-gray-700 bg-white hover:bg-gray-100'
                                        }`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}


                </CardContent>
            </Card>

            {/* Place Order Dialog (keeps same UI fields) */}
            <Dialog
                open={isPlaceOrderDialogOpen}
                onOpenChange={(open) => {
                    // Don't close if clicking on Google Autocomplete dropdown
                    if (!open) {
                        // First check the flag set by event handlers
                        if ((window as any).isPacClick === true) {
                            console.log('Preventing modal close - pac click detected');
                            // Don't clear the flag yet, let the timeout handle it
                            return; // Don't close
                        }

                        // Check if click target is pac-container or pac-item
                        const clickTarget = (window as any).lastClickTarget;
                        if (clickTarget) {
                            const isPacClick = clickTarget.closest && (
                                clickTarget.closest('.pac-container') ||
                                clickTarget.closest('.pac-item')
                            );
                            if (isPacClick) {
                                console.log('Preventing modal close - pac click target detected');
                                // Clear the stored target
                                (window as any).lastClickTarget = null;
                                (window as any).isPacClick = false;
                                return; // Don't close
                            }
                        }

                        // Also check if pac-container is currently visible and click was inside it
                        const pacContainer = document.querySelector('.pac-container') as HTMLElement;
                        if (pacContainer && pacContainer.style.display !== 'none') {
                            const activeElement = document.activeElement;
                            if (pacContainer.contains(activeElement as Node)) {
                                console.log('Preventing modal close - active element in pac-container');
                                return; // Don't close
                            }
                        }
                    }
                    // Clear stored target when closing
                    (window as any).lastClickTarget = null;
                    (window as any).isPacClick = false;
                    setIsPlaceOrderDialogOpen(open);
                }}
            >
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" style={{ zIndex: 50 }}>
                    <DialogHeader>
                        <DialogTitle>Place New Order</DialogTitle>
                        <DialogDescription>Enter the details for the new order.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* Customer */}
                        <div className="col-span-2 grid gap-2">
                            <Label htmlFor="customer">Customer <span className="text-red-500">*</span></Label>
                            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={customerSearchOpen}
                                        className={`justify-between ${orderErrors.customerId ? 'border-red-500' : ''}`}
                                    >
                                        {newOrder.customerId ? (customers.find((c) => c.id === Number(newOrder.customerId))?.company_name ?? 'Selected customer') : 'Select customer...'}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[400px] p-0 max-h-[400px] overflow-hidden"
                                >
                                    <Command className="h-full flex flex-col">
                                        <CommandInput placeholder="Search customer..." />
                                        <CommandList
                                            className="max-h-[300px] overflow-y-auto overscroll-contain"
                                            onWheel={(e) => {
                                                e.stopPropagation();
                                            }}
                                        >
                                            <CommandEmpty>No customer found.</CommandEmpty>
                                            <CommandGroup>
                                                {customers.map((customer) => (
                                                    <CommandItem
                                                        key={customer.id}
                                                        value={customer.company_name}
                                                        onSelect={() => {
                                                            setNewOrder((n) => ({ ...n, customerId: String(customer.id) }));
                                                            setOrderErrors((prev) => ({ ...prev, customerId: '' }));
                                                            setCustomerSearchOpen(false);
                                                        }}
                                                    >
                                                        <div>
                                                            <div>{customer.company_name}</div>
                                                            <div className="text-xs text-slate-500">{customer.first_name} {customer.last_name}</div>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {orderErrors.customerId && (
                                <p className="text-sm text-red-500">{orderErrors.customerId}</p>
                            )}
                        </div>

                        {/* Number of Cases */}
                        <div className="grid gap-2">
                            <Label htmlFor="quantity">Number of Cases <span className="text-red-500">*</span></Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={newOrder.quantity}
                                onChange={(e) => {
                                    setNewOrder((n) => ({ ...n, quantity: e.target.value }));
                                    if (orderErrors.quantity) setOrderErrors((prev) => ({ ...prev, quantity: '' }));
                                }}
                                placeholder="Enter number of cases"
                                className={orderErrors.quantity ? 'border-red-500' : ''}
                            />
                            {orderErrors.quantity && (
                                <p className="text-sm text-red-500">{orderErrors.quantity}</p>
                            )}
                        </div>

                        {/* Delivery Date */}
                        <div className="grid gap-2">
                            <Label htmlFor="deliveryDate">Delivery Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input
                                    id="deliveryDate"
                                    type="date"
                                    value={newOrder.deliveryDate}
                                    onChange={(e) => {
                                        setNewOrder((n) => ({ ...n, deliveryDate: e.target.value }));
                                        if (orderErrors.deliveryDate) setOrderErrors((prev) => ({ ...prev, deliveryDate: '' }));
                                    }}
                                    placeholder="mm/dd/yyyy"
                                    className={`pr-10 ${orderErrors.deliveryDate ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {orderErrors.deliveryDate && (
                                <p className="text-sm text-red-500">{orderErrors.deliveryDate}</p>
                            )}
                        </div>

                        {/* Assign Driver (Optional) */}
                        <div className="grid gap-2">
                            <Label htmlFor="driverId">Assign Driver</Label>
                            <Select
                                value={selectedDriver}
                                onValueChange={(value) => {
                                    setSelectedDriver(value);
                                    setNewOrder((n) => ({ ...n, driverId: value }));
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select driver (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {drivers.length > 0 ? (
                                        drivers.map((driver) => (
                                            <SelectItem key={driver.id} value={String(driver.id)}>
                                                {driver.driver_name} — {driver.zone}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem disabled value="no-drivers">
                                            No drivers available
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Delivery Address */}
                        <div className="col-span-2 grid gap-2">
                            <Label htmlFor="deliveryAddress">Delivery Address <span className="text-red-500">*</span></Label>
                            <AddressAutocomplete
                                key={isPlaceOrderDialogOpen ? 'address-input' : 'address-input-closed'}
                                value={newOrder.deliveryAddress}
                                onChange={(value) => {
                                    setNewOrder((n) => ({ ...n, deliveryAddress: value }));
                                    if (orderErrors.deliveryAddress) setOrderErrors((prev) => ({ ...prev, deliveryAddress: '' }));
                                }}
                                className={orderErrors.deliveryAddress ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-[#00a1ff]'}
                                placeholder="Enter delivery address"
                                isModalOpen={isPlaceOrderDialogOpen}
                            />
                            {orderErrors.deliveryAddress && (
                                <p className="text-sm text-red-500">{orderErrors.deliveryAddress}</p>
                            )}
                        </div>

                        {/* Customer Company Logo (Optional) */}
                        <div className="col-span-2 grid gap-2">
                            <Label htmlFor="customerLogo">Customer Company Logo (Optional)</Label>
                            {customerLogoPreview ? (
                                <div className="relative inline-block">
                                    <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50">
                                        <img src={customerLogoPreview} alt="Customer logo preview" className="w-full h-full object-cover" />
                                    </div>
                                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={handleRemoveLogo}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <label className="cursor-pointer">
                                        <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-colors">
                                            <Upload className="w-4 h-4 text-slate-500" />
                                            <span className="text-sm text-slate-600">Upload Logo</span>
                                        </div>
                                        <input type="file" id="customerLogo" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                    <span className="text-xs text-slate-500">PNG, JPG up to 5MB</span>
                                </div>
                            )}
                        </div>

                        {/* Delivery Status */}
                        <div className="grid gap-2">
                            <Label htmlFor="deliveryStatus">Delivery Status <span className="text-red-500">*</span></Label>
                            <Select
                                value={newOrder.deliveryStatus}
                                onValueChange={(value) => {
                                    setNewOrder((n) => ({ ...n, deliveryStatus: value }));
                                    if (orderErrors.deliveryStatus) setOrderErrors((prev) => ({ ...prev, deliveryStatus: '' }));
                                }}
                            >
                                <SelectTrigger className={orderErrors.deliveryStatus ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select delivery status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="pending payment">Pending payment</SelectItem>
                                    <SelectItem value="driver assigned">Driver assigned</SelectItem>
                                    <SelectItem value="in transit">In transit</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="unable to driver">Unable to driver</SelectItem>
                                </SelectContent>
                            </Select>
                            {orderErrors.deliveryStatus && (
                                <p className="text-sm text-red-500">{orderErrors.deliveryStatus}</p>
                            )}
                        </div>

                        {/* PO Number (Optional) */}
                        <div className="grid gap-2">
                            <Label htmlFor="poNumber">PO Number (Optional)</Label>
                            <Input
                                id="poNumber"
                                value={newOrder.poNumber}
                                onChange={(e) => setNewOrder((n) => ({ ...n, poNumber: e.target.value }))}
                                placeholder="Enter PO number"
                            />
                        </div>

                        {/* Special Instructions (Optional) */}
                        <div className="col-span-2 grid gap-2">
                            <Label htmlFor="specialInstructions">Special Instructions (Optional)</Label>
                            <Textarea
                                id="specialInstructions"
                                value={newOrder.specialInstructions}
                                onChange={(e) => setNewOrder((n) => ({ ...n, specialInstructions: e.target.value }))}
                                placeholder="Add any special instructions..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsPlaceOrderDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handlePlaceOrder} disabled={loadingPlaceOrder}>
                            {loadingPlaceOrder ? 'Placing...' : 'Place Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Driver Dialog */}
            <Dialog open={isAssignDriverDialogOpen} onOpenChange={setIsAssignDriverDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Assign Driver to Order</DialogTitle>
                        <DialogDescription>Select an available driver to assign to {selectedOrderForDriver}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label>Available Drivers</Label>
                            <div className="space-y-2">
                                {drivers.map((driver) => (
                                    <button
                                        key={driver.id}
                                        onClick={() => setSelectedDriverForAssignment(String(driver.id))}
                                        disabled={driver.status === 'En Route' || driver.status === 'Assigned'}
                                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${driver.status === 'En Route' || driver.status === 'Assigned'
                                            ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                                            : selectedDriverForAssignment === String(driver.id)
                                                ? 'border-sky-500 bg-sky-50 cursor-pointer'
                                                : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium">{driver.driver_name}</span>
                                                    <Badge className={`text-xs ${getDriverStatusColor(driver.status)}`}>{driver.status}</Badge>
                                                </div>
                                                <div className="text-sm text-slate-600">{driver.phone_number}</div>
                                            </div>
                                            {selectedDriverForAssignment === String(driver.id) && driver.status === 'Available' && <Check className="w-5 h-5 text-sky-600" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <div className="text-blue-700 mt-0.5">ℹ️</div>
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">Driver Status Guide:</p>
                                    <ul className="text-xs space-y-0.5 text-blue-700">
                                        <li><span className="font-medium">Available:</span> Ready for new assignments</li>
                                        <li><span className="font-medium">Assigned:</span> Order assigned but not yet dispatched</li>
                                        <li><span className="font-medium">En Route:</span> Currently delivering an order</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAssignDriverDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAssignDriver} disabled={!selectedDriverForAssignment || loadingAssign}>
                            {loadingAssign ? 'Assigning...' : 'Assign Driver'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Assign Driver Dialog */}
            <Dialog open={isBulkAssignDriverDialogOpen} onOpenChange={setIsBulkAssignDriverDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Assign Driver to Multiple Orders</DialogTitle>
                        <DialogDescription>
                            Select a driver to assign to {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label>Selected Orders:</Label>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(selectedOrders).map(orderId => {
                                        const order = orders.find(o => o.id === orderId);
                                        return (
                                            <span key={orderId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                                {order?.order_name || `Order ${orderId}`}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Available Drivers</Label>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {drivers.map((driver) => (
                                    <button
                                        key={driver.id}
                                        onClick={() => setSelectedDriverForBulkAssignment(String(driver.id))}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${selectedDriverForBulkAssignment === String(driver.id)
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-900">{driver.driver_name}</p>
                                                <p className="text-sm text-gray-600">{driver.phone_number}</p>
                                            </div>
                                            <Badge
                                                className={
                                                    driver.status === 'Available'
                                                        ? 'bg-green-100 text-green-800'
                                                        : driver.status === 'En Route'
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : 'bg-blue-100 text-blue-800'
                                                }
                                            >
                                                {driver.status}
                                            </Badge>
                                        </div>
                                    </button>
                                ))}
                                {drivers.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">No drivers available</p>
                                )}
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <div className="text-blue-700 mt-0.5">ℹ️</div>
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">Bulk Assignment:</p>
                                    <p className="text-xs text-blue-700">
                                        The selected driver will be assigned to all {selectedOrders.size} selected orders simultaneously.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsBulkAssignDriverDialogOpen(false)}>Cancel</Button>
                        <Button
                            type="button"
                            onClick={handleBulkAssignDriver}
                            disabled={!selectedDriverForBulkAssignment || selectedOrders.size === 0 || loadingBulkAssign}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Truck className="h-4 w-4 mr-2" />
                            {loadingBulkAssign ? 'Assigning...' : `Assign to ${selectedOrders.size} Order${selectedOrders.size > 1 ? 's' : ''}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
