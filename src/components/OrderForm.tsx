'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowLeft, Save, Upload, X, Download, User, Package, Truck, FileText, Image as ImageIcon, ChevronsUpDown } from 'lucide-react';
import Autocomplete from 'react-google-autocomplete';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Address Autocomplete Component
interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

function AddressAutocomplete({ value, onChange, className, placeholder }: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Fix z-index and positioning for Google Autocomplete dropdown
    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'google-autocomplete-styles';
        
        
        const existingStyle = document.getElementById('google-autocomplete-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        document.head.appendChild(style);

        return () => {
            const styleToRemove = document.getElementById('google-autocomplete-styles');
            if (styleToRemove) {
                styleToRemove.remove();
            }
        };
    }, []);

    // Update input value when value prop changes
    useEffect(() => {
        if (inputRef.current && inputRef.current.value !== value) {
            inputRef.current.value = value || '';
        }
    }, [value]);

    const handlePlaceSelected = (place: any) => {
        const address = place.formatted_address || place.name || '';
        if (inputRef.current) {
            inputRef.current.value = address;
        }
        onChange(address);
    };

    return (
        <div className="relative" style={{ position: 'relative', zIndex: 1 }}>
            <Autocomplete
                apiKey="AIzaSyBVlRB_xJNrgPjlukxTrCDCfjzYuqfN0Q0"
                onPlaceSelected={handlePlaceSelected}
                options={{
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                }}
                defaultValue={value}
                className={className}
                placeholder={placeholder}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            />
        </div>
    );
}

interface OrderFormProps {
    mode: 'create' | 'edit';
    orderId?: string;
    initialData?: any;
}

export function OrderForm({ mode, orderId, initialData }: OrderFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(mode === 'edit');
    const [customers, setCustomers] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [previousDeliveryStatus, setPreviousDeliveryStatus] = useState<string | null>(null);
    const [orderBeforeUpdate, setOrderBeforeUpdate] = useState<any>(null);

    const [formData, setFormData] = useState({
        customerId: '',
        franchiseId: '',
        productType: 'Case',
        quantity: '',
        poNumber: '',
        specialInstructions: '',
        deliveryAddress: '',
        deliveryStatus: 'pending',
        driverId: '',
        logo: '',
        orderDate: '',
        orderTime: '',
    });
    const [franchises, setFranchises] = useState<any[]>([]);
    const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
    const [showNewAddressInput, setShowNewAddressInput] = useState(false);
    const [isUnableToDeliverDialogOpen, setIsUnableToDeliverDialogOpen] = useState(false);
    const [unableToDeliverReason, setUnableToDeliverReason] = useState('');
    const [displayFranchiseName, setDisplayFranchiseName] = useState<string>('');
    const [displayCompanyName, setDisplayCompanyName] = useState<string>('');

    useEffect(() => {
        fetchCustomers();
        fetchDrivers();
        fetchFranchises();
        fetchCompanies();
        if (mode === 'edit' && orderId) {
            fetchOrder();
        } else if (initialData) {
            // Load initial data if provided
            setFormData({
                customerId: initialData.customer_id ? String(initialData.customer_id) : '',
                franchiseId: initialData.franchise_id ? String(initialData.franchise_id) : '',
                productType: 'Case',
                quantity: initialData.quantity ? String(initialData.quantity) : '',
                poNumber: initialData.po_number || '',
                specialInstructions: initialData.special_instructions || '',
                deliveryAddress: initialData.delivery_address || '',
                deliveryStatus: initialData.deliveryStatus || initialData.status || 'processing',
                driverId: initialData.driver_id ? String(initialData.driver_id) : '',
                logo: initialData.special_event_logo || '',
                orderDate: initialData.order_date ? new Date(initialData.order_date).toISOString().slice(0, 10) : '',
                orderTime: initialData.order_date ? new Date(initialData.order_date).toTimeString().slice(0, 5) : '',
            });

            if (initialData.special_event_logo) {
                setLogoPreview(initialData.special_event_logo);
            }
        }
    }, [mode, orderId, initialData]);

    useEffect(() => {
        if (mode !== 'create') return;
        setFormData((prev) => {
            if (prev.orderDate || prev.orderTime) return prev;
            const now = new Date();
            const date = now.toISOString().slice(0, 10);
            const time = now.toTimeString().slice(0, 5);
            return { ...prev, orderDate: date, orderTime: time };
        });
    }, [mode]);

    // Auto-select first delivery address when customer addresses are loaded
    useEffect(() => {
        if (formData.customerId && customerAddresses.length > 0 && !formData.deliveryAddress) {
            setFormData((prev) => ({ ...prev, deliveryAddress: customerAddresses[0].address }));
        }
    }, [customerAddresses, formData.customerId]);

    async function fetchOrder() {
        if (!orderId) return;
        setFetching(true);
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
                router.push('/admin/orders');
                return;
            }

            // Store full order object for notification
            setOrderBeforeUpdate(order);

            // Store previous status for comparison
            const prevStatus = order.deliveryStatus || order.status || 'processing';
            setPreviousDeliveryStatus(prevStatus);

            setFormData({
                customerId: order.customer_id ? String(order.customer_id) : '',
                franchiseId: order.franchise_id ? String(order.franchise_id) : '',
                productType: 'Case',
                quantity: order.quantity ? String(order.quantity) : '',
                poNumber: order.po_number || '',
                specialInstructions: order.special_instructions || '',
                deliveryAddress: order.delivery_address || '',
                deliveryStatus: prevStatus,
                driverId: order.driver_id ? String(order.driver_id) : '',
                logo: order.special_event_logo || '',
                orderDate: order.order_date ? new Date(order.order_date).toISOString().slice(0, 10) : '',
                orderTime: order.order_date ? new Date(order.order_date).toTimeString().slice(0, 5) : '',
            });

            // Load unable to deliver reason if exists
            if (order.unable_to_deliver_reason) {
                setUnableToDeliverReason(order.unable_to_deliver_reason);
            }

            if (order.special_event_logo) {
                setLogoPreview(order.special_event_logo);
            }

            // Parse customer addresses if customer is selected
            // Wait for customers to be loaded first
            if (order.customer_id) {
                // Fetch customer data to get addresses
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('delivery_address, franchise_id, company_name')
                    .eq('id', order.customer_id)
                    .single();
                
                if (customerData?.delivery_address) {
                    parseCustomerAddresses(customerData.delivery_address);
                }
                
                // Set franchise and company names for display
                const isSuperAdmin = typeof window !== 'undefined' 
                    ? localStorage.getItem('is_super_admin') === 'true'
                    : false;
                
                if (customerData?.franchise_id) {
                    const franchise = franchises.find((f) => f.id === customerData.franchise_id);
                    if (franchise) {
                        setDisplayFranchiseName(franchise.franchise_name);
                    } else {
                        setDisplayFranchiseName(isSuperAdmin ? 'Miami (Primary Store)' : '');
                    }
                } else if (isSuperAdmin) {
                    setDisplayFranchiseName('Miami (Primary Store)');
                } else {
                    setDisplayFranchiseName('');
                }
                
                if (customerData?.company_name) {
                    setDisplayCompanyName(customerData.company_name);
                } else {
                    setDisplayCompanyName('');
                }
            }
        } catch (err) {
            console.error('Error fetching order:', err);
            alert('Failed to load order');
            router.push('/admin/orders');
        } finally {
            setFetching(false);
        }
    }

    async function fetchCustomers() {
        try {
            const currentFranchiseId = typeof window !== 'undefined' 
                ? localStorage.getItem('current_franchise_id') 
                : null;
            const isSuperAdmin = typeof window !== 'undefined' 
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;

            // IMPORTANT: Explicitly select franchise_id to ensure it's included
            // Note: Use companyLogo (not company_logo) as per database schema
            let query = supabase.from('customers').select('id, company_name, first_name, last_name, email, phone, delivery_address, franchise_id, companyLogo, custom_price_per_unit, delivery_zone, delivery_zone_name, zoneCity, industry, alternateEmail1, alternateEmail2, alternatePhone').order('company_name');
            if (!isSuperAdmin && currentFranchiseId) {
                query = query.eq('franchise_id', currentFranchiseId);
            }
            // If Super Admin, don't filter - show all customers
            const { data, error } = await query;
            if (error) throw error;
            console.log('📋 Fetched customers with franchise_id:', (data || []).slice(0, 3).map((c: any) => ({ 
                id: c.id, 
                company: c.company_name, 
                franchise_id: c.franchise_id 
            })));
            setCustomers(data || []);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    }

    async function fetchDrivers() {
        try {
            const currentFranchiseId = typeof window !== 'undefined' 
                ? localStorage.getItem('current_franchise_id') 
                : null;
            const isSuperAdmin = typeof window !== 'undefined' 
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;

            let query = supabase.from('drivers').select('*').order('driver_name');
            if (!isSuperAdmin && currentFranchiseId) {
                query = query.eq('franchise_id', currentFranchiseId);
            }
            const { data, error } = await query;
            if (error) throw error;
            setDrivers(data || []);
        } catch (err) {
            console.error('Error fetching drivers:', err);
        }
    }

    async function fetchFranchises() {
        try {
            const { data, error } = await supabase
                .from('franchises')
                .select('*')
                .order('franchise_name');
            if (error) throw error;
            setFranchises(data || []);
            
            // Set default franchise: Miami (Primary Store) for super admin, or current franchise for franchise user
            const currentFranchiseId = typeof window !== 'undefined' 
                ? localStorage.getItem('current_franchise_id') 
                : null;
            const isSuperAdmin = typeof window !== 'undefined' 
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;

            // If franchise user is logged in, use their franchise_id instead of Miami (Primary Store)
            if (!isSuperAdmin && currentFranchiseId && mode === 'create') {
                setFormData((prev) => {
                    if (prev.franchiseId === 'miami-primary-store') {
                        return { ...prev, franchiseId: String(currentFranchiseId) };
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.error('Error fetching franchises:', err);
        }
    }

    async function fetchCompanies() {
        try {
            const { data, error } = await supabase
                .from('company')
                .select('*')
                .order('company_name');
            if (error) throw error;
            setCompanies(data || []);
        } catch (err) {
            console.error('Error fetching companies:', err);
        }
    }

    // Parse customer addresses from delivery_address field
    function parseCustomerAddresses(deliveryAddress: any): void {
        if (!deliveryAddress) {
            setCustomerAddresses([]);
            return;
        }

        try {
            // Try to parse as JSON if it's a string
            let addresses = deliveryAddress;
            if (typeof deliveryAddress === 'string') {
                try {
                    addresses = JSON.parse(deliveryAddress);
                } catch {
                    // Not JSON, treat as single address string
                    setCustomerAddresses([{ label: 'Default Address', address: deliveryAddress }]);
                    return;
                }
            }

            // Handle array of addresses
            if (Array.isArray(addresses)) {
                const formattedAddresses = addresses.map((addr: any, index: number) => {
                    if (typeof addr === 'string') {
                        return { label: `Address ${index + 1}`, address: addr };
                    }
                    if (typeof addr === 'object' && addr !== null) {
                        // Format address from object
                        const parts = [
                            addr.street,
                            addr.city,
                            addr.state,
                            addr.zipCode
                        ].filter(Boolean);
                        const formattedAddr = parts.join(', ') || addr.address || addr.formatted_address || '';
                        return {
                            label: addr.label || `Address ${index + 1}`,
                            address: formattedAddr,
                            original: addr
                        };
                    }
                    return { label: `Address ${index + 1}`, address: String(addr) };
                });
                setCustomerAddresses(formattedAddresses);
            } else if (typeof addresses === 'object' && addresses !== null) {
                // Single address object
                const parts = [
                    addresses.street,
                    addresses.city,
                    addresses.state,
                    addresses.zipCode
                ].filter(Boolean);
                const formattedAddr = parts.join(', ') || addresses.address || addresses.formatted_address || '';
                setCustomerAddresses([{
                    label: addresses.label || 'Default Address',
                    address: formattedAddr,
                    original: addresses
                }]);
            } else {
                // Single string address
                setCustomerAddresses([{ label: 'Default Address', address: String(addresses) }]);
            }
        } catch (err) {
            console.error('Error parsing customer addresses:', err);
            // Fallback: treat as single address string
            setCustomerAddresses([{ label: 'Default Address', address: String(deliveryAddress) }]);
        }
    }

    async function uploadLogoFile(file: File): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = fileName; // Just the filename, bucket handles the path

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: false });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return null;
            }

            const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (err) {
            console.error('Error uploading logo:', err);
            return null;
        }
    }

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setLogoPreview(result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
        setFormData((prev) => ({ ...prev, logo: '' }));
    };

    const buildOrderDateIso = (date: string, time: string) => {
        if (!date || !time) return new Date().toISOString();
        const composed = `${date}T${time}:00`;
        const parsed = new Date(composed);
        if (isNaN(parsed.getTime())) return new Date().toISOString();
        return parsed.toISOString();
    };

    function validateForm(): boolean {
        const newErrors: Record<string, string> = {};
        if (!formData.customerId) newErrors.customerId = 'Customer is required';
        if (!formData.quantity) newErrors.quantity = 'Quantity is required';
        if (!formData.deliveryAddress) newErrors.deliveryAddress = 'Delivery address is required';
        if (!formData.deliveryStatus) newErrors.deliveryStatus = 'Delivery status is required';
        if (mode === 'create') {
            if (!formData.orderDate) newErrors.orderDate = 'Order date is required';
            if (!formData.orderTime) newErrors.orderTime = 'Order time is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    // --- Send FCM notification via Supabase Edge Function ---
    const sendFCMNotification = async (tokens: string[], title: string, message: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
                body: JSON.stringify({
                    tokens,
                    title,
                    message,
                }),
            });

            if (error) {
                console.error('Error sending FCM notification:', error);
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }

            return { success: true, data };
        } catch (error) {
            console.error('Error sending FCM notification:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    };

    // --- Send notification to driver and customer when order status changes ---
    const sendStatusChangeNotification = async (order: any, newStatus: string) => {
        try {
            const tokens: string[] = [];
            const recipientIds: number[] = [];
            const notificationTitle = `Order ${order.order_name} Status Updated`;
            // Format status for display (capitalize first letter of each word)
            const formattedStatus = newStatus
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            let notificationMessage = `Your order ${order.order_name} status has been updated to ${formattedStatus}.`;

            // Fetch customer FCM token (only for allowed statuses)
            const allowedCustomerStatuses = ['pending', 'completed', 'cancelled', 'driver assigned'];
            if (order.customer_id && allowedCustomerStatuses.includes(newStatus.toLowerCase())) {
                const { data: customerData, error: customerError } = await supabase
                    .from('customers')
                    .select('fcm_token, company_name, first_name, last_name')
                    .eq('id', order.customer_id)
                    .maybeSingle();

                if (!customerError && customerData && customerData.fcm_token) {
                    tokens.push(customerData.fcm_token);
                    recipientIds.push(order.customer_id);
                    console.log(`📱 Found customer FCM token for order ${order.order_name}`);
                }
            }

            // Fetch driver FCM token
            if (order.driver_id) {
                console.log('order.driver_id', order.driver_id);
                const { data: driverData, error: driverError } = await supabase
                    .from('drivers')
                    .select('fcm_token, driver_name')
                    .eq('id', order.driver_id)
                    .maybeSingle();

                if (!driverError && driverData && driverData.fcm_token) {
                    tokens.push(driverData.fcm_token);
                    recipientIds.push(order.driver_id);
                    console.log(`🚗 Found driver FCM token for order ${order.order_name}`);
                }
            }

            // Send notification if tokens found
            if (tokens.length > 0) {
                await sendFCMNotification(tokens, notificationTitle, notificationMessage);
                console.log(`✅ Status change notification sent to ${tokens.length} recipient(s)`);
            } else {
                console.log('ℹ️ No FCM tokens found for driver or customer');
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
            };

            const { error: notifError } = await supabase
                .from('notifications')
                .insert([notificationData]);

            if (notifError) {
                console.error('Error saving notification to database:', notifError);
            } else {
                console.log('✅ Notification saved to database');
            }
        } catch (error) {
            console.error('Error sending status change notification:', error);
            // Don't block status update if notification fails
        }
    };

    // --- Update driver status when assigned to an order ---
    const updateDriverAssignmentStatus = async (driverId: number | null) => {
        if (!driverId) return;

        try {
            const { error } = await supabase
                .from('drivers')
                .update({ status: 'Assigned' })
                .eq('id', driverId);

            if (error) {
                console.error('Error updating driver assignment status:', error);
            } else {
                console.log(`✅ Driver ${driverId} status updated to Assigned`);
            }
        } catch (err) {
            console.error('Unexpected error updating driver assignment status:', err);
        }
    };

    async function handleSave() {
        if (!validateForm()) return;

        setLoading(true);
        try {
            let logoUrl: string | null = formData.logo || null;
            if (logoPreview && logoPreview.startsWith('data:')) {
                try {
                    const res = await fetch(logoPreview);
                    const blob = await res.blob();
                    const file = new File([blob], `logo-${Date.now()}.png`, { type: blob.type });
                    logoUrl = await uploadLogoFile(file);
                } catch (err) {
                    console.error('Error converting logo:', err);
                }
            } else if (!logoPreview && formData.logo) {
                logoUrl = null;
            }

            const currentFranchiseId = typeof window !== 'undefined' 
                ? localStorage.getItem('current_franchise_id') 
                : null;
            const isSuperAdmin = typeof window !== 'undefined' 
                ? localStorage.getItem('is_super_admin') === 'true'
                : false;
            const currentStaffEmail = typeof window !== 'undefined' 
                ? localStorage.getItem('current_staff_email') 
                : null;

            const selectedCustomer = customers.find((c) => c.id === Number(formData.customerId));
            
            // Get customer's franchise_id for payload (must be declared before use)
            const customerFranchiseId = selectedCustomer?.franchise_id || null;
            
            // Find company by company_name to get company_id
            let companyId: string | null = null;
            if (selectedCustomer?.company_name) {
                const company = companies.find((comp) => comp.company_name === selectedCustomer.company_name);
                if (company) {
                    companyId = company.id;
                }
            }

            // Determine franchise_id: 
            // Priority: customer's franchise_id (from selected customer) > super admin's selected franchise > current franchise
            console.log('🔍 FRANCHISE ID DEBUG - START:', {
                formDataFranchiseId: formData.franchiseId,
                formDataFranchiseIdType: typeof formData.franchiseId,
                isSuperAdmin,
                currentFranchiseId,
                customerFranchiseId,
                selectedCustomerId: selectedCustomer?.id,
                selectedCustomerCompany: selectedCustomer?.company_name,
                franchisesCount: franchises.length,
                allFranchises: franchises.map((f: any) => ({ id: f.id, name: f.franchise_name }))
            });
            
            // franchise_id is UUID (string), not number
            let orderFranchiseId: string | null = null;
            
            // Priority 1: ALWAYS use customer's franchise_id if customer is selected and has franchise_id
            if (selectedCustomer && customerFranchiseId) {
                orderFranchiseId = String(customerFranchiseId);
                console.log('✅ Using customer franchise_id:', orderFranchiseId, 'from customer:', selectedCustomer.company_name);
            } else if (isSuperAdmin) {
                console.log('✅ Super Admin detected - no customer franchise_id, using form selection');
                // Super admin: use selected franchise ID (only if customer doesn't have franchise_id)
                if (formData.franchiseId === 'miami-primary-store') { 
                    // Miami (Primary Store) is just for display - don't send any franchise_id
                    orderFranchiseId = null;
                } else if (formData.franchiseId && formData.franchiseId.trim() !== '') { 
                    // UUID string - use directly
                    orderFranchiseId = String(formData.franchiseId);
                    console.log('✅ Franchise ID used directly:', orderFranchiseId);
                } else {
                    console.warn('⚠️ No franchise selected in formData');
                    // No franchise selected - keep it null
                    orderFranchiseId = null;
                }
            } else {
                console.log('👤 Franchise User detected - no customer franchise_id, using current franchise');
                // For franchise user, use their current franchise_id (UUID string)
                orderFranchiseId = currentFranchiseId ? String(currentFranchiseId) : null;
                console.log('✅ Franchise user ID:', orderFranchiseId);
            }
            
            console.log('🔍 FRANCHISE ID DEBUG - END:', {
                finalOrderFranchiseId: orderFranchiseId,
                finalOrderFranchiseIdType: typeof orderFranchiseId,
                customerFranchiseIdUsed: customerFranchiseId ? String(customerFranchiseId) : null
            });
            
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
            } : null;

            // Get customer logo for logo key
            const customerLogo = selectedCustomer?.companyLogo || selectedCustomer?.company_logo || selectedCustomer?.logo || null;

            // Get selected driver details
            const selectedDriver = drivers.find((d) => d.id === Number(formData.driverId));
            const driverName = selectedDriver?.driver_name || null;
            const driverNumber = selectedDriver?.phone_number || null;
            const driverEmail = selectedDriver?.email || null;

            if (mode === 'create') {
                const orderName = `ORD-${Date.now().toString().slice(-6)}`;
                const orderDateIso = buildOrderDateIso(formData.orderDate, formData.orderTime);
                const now = new Date().toISOString();
                console.log('📦 CREATING ORDER PAYLOAD - BEFORE:', {
                    orderFranchiseId,
                    orderFranchiseIdType: typeof orderFranchiseId,
                    isNull: orderFranchiseId === null,
                    isUndefined: orderFranchiseId === undefined,
                    formDataFranchiseId: formData.franchiseId,
                    customerFranchiseId,
                    selectedCustomerId: selectedCustomer?.id,
                    selectedCustomerCompany: selectedCustomer?.company_name,
                    mode: 'create'
                });
                
                // IMPORTANT: If customer is selected, ALWAYS use customer's franchise_id
                // Only use fallback if no customer is selected or customer has no franchise_id
                if (!orderFranchiseId && isSuperAdmin && formData.franchiseId && !selectedCustomer) {
                    // Only use formData.franchiseId if no customer is selected
                    // But skip if it's "miami-primary-store" (should remain null)
                    if (formData.franchiseId !== 'miami-primary-store') {
                        orderFranchiseId = String(formData.franchiseId);
                        console.log('🔄 Re-assigning franchise_id from formData (no customer selected):', orderFranchiseId);
                    }
                }
                
                console.log('📦 CREATING ORDER PAYLOAD - AFTER:', {
                    orderFranchiseId,
                    orderFranchiseIdType: typeof orderFranchiseId,
                    customerFranchiseIdUsed: customerFranchiseId ? String(customerFranchiseId) : null
                });
                
                // Final check: Ensure franchise_id is set correctly
                // If orderFranchiseId is still null/undefined and we have a customer, try to get it from customer again
                if (!orderFranchiseId && selectedCustomer) {
                    // Try to get franchise_id directly from customer
                    const directCustomerFranchiseId = selectedCustomer.franchise_id;
                    if (directCustomerFranchiseId) {
                        orderFranchiseId = String(directCustomerFranchiseId);
                        console.log('🔄 Re-fetching franchise_id from customer:', orderFranchiseId);
                    }
                }
                
                const orderPayload: any = {
                    order_name: orderName,
                    logo: customerLogo,
                    special_event_logo: logoUrl,
                    customer_id: formData.customerId || null,
                    company_id: companyId,
                    customer_details: customerDetails,
                    po_number: formData.poNumber || null,
                    order_date: orderDateIso,
                    delivery_address: formData.deliveryAddress || null, 
                    deliveryStatus: formData.deliveryStatus || null,
                    special_instructions: formData.specialInstructions || null,
                    quantity: Number(formData.quantity) || 1,
                    product_type: 'Case',
                    driver_id: formData.driverId ? Number(formData.driverId) : null,
                    driver_name: driverName,
                    driver_number: driverNumber,
                    driver_email: driverEmail,
                    franchise_id: orderFranchiseId || null, // Explicitly set to null if undefined
                    created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
                    created_at: now,
                    unable_to_deliver_reason: formData.deliveryStatus === 'undelivered' ? unableToDeliverReason : null,
                    status_change_count: 1, // New orders start with count 1
                };
                
                console.log('📦 FINAL ORDER PAYLOAD:', {
                    ...orderPayload,
                    franchise_id: orderPayload.franchise_id,
                    franchise_id_type: typeof orderPayload.franchise_id,
                    franchise_id_isNull: orderPayload.franchise_id === null,
                    franchise_id_isUndefined: orderPayload.franchise_id === undefined,
                    selectedCustomerFranchiseId: selectedCustomer?.franchise_id,
                    customerFranchiseId: customerFranchiseId
                });

                const { data: insertedOrder, error } = await supabase.from('orders').insert(orderPayload).select().single();
                if (error) throw error;

                // If a driver is selected on create, mark that driver as Assigned
                if (formData.driverId) {
                    await updateDriverAssignmentStatus(Number(formData.driverId));
                }

                // Send email to customer when order is created (order placed)
                if (selectedCustomer?.email) {
                    try {
                        const createEmailStatus = formData.deliveryStatus || null;
                        await supabase.functions.invoke('send_order_email', {
                            body: JSON.stringify({
                                to: selectedCustomer.email,
                                customer_name: selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 'Customer',
                                order_name: orderName,
                                order_id: insertedOrder.id,
                                delivery_status: createEmailStatus,
                                quantity: formData.quantity,
                                email_type: 'order_created'
                            })
                        });
                    } catch (emailErr: any) {
                        console.error('Error sending order creation email:', emailErr);
                        // Don't block order creation if email fails
                    }
                }
                // Send push notification to customer for "order placed"
                if (selectedCustomer) {
                    try {
                        const { data: customerData } = await supabase
                            .from('customers')
                            .select('fcm_token')
                            .eq('id', selectedCustomer.id)
                            .maybeSingle();
                        if (customerData?.fcm_token) {
                            const title = `Order ${orderName} Placed`;
                            const message = `Your order ${orderName} has been placed successfully.`;
                            await sendFCMNotification([customerData.fcm_token], title, message);
                        }
                    } catch (pushErr) {
                        console.error('Error sending order placed push:', pushErr);
                    }
                }
            } else {
                // Edit mode - use selected delivery status from dropdown (payload source of truth)
                const effectiveDeliveryStatus = formData.deliveryStatus || null;
                const statusChanged = (previousDeliveryStatus || '').toLowerCase().trim() !== (effectiveDeliveryStatus || '').toLowerCase().trim();
                const driverAssignedOrChanged = !!formData.driverId && (Number(orderBeforeUpdate?.driver_id || 0) !== Number(formData.driverId));

                // Get current status_change_count and increment if status changed
                const currentCount = Number(orderBeforeUpdate?.status_change_count) || 1;
                const newCount = statusChanged ? currentCount + 1 : currentCount;

                // Get customer's franchise_id for update payload
                const customerFranchiseIdForUpdate = selectedCustomer?.franchise_id || null;
                let updateFranchiseId: string | null = null;
                
                // Priority: customer's franchise_id > super admin's selected franchise > current franchise
                if (customerFranchiseIdForUpdate) {
                    updateFranchiseId = String(customerFranchiseIdForUpdate);
                } else if (isSuperAdmin) {
                    if (formData.franchiseId === 'miami-primary-store') {
                        updateFranchiseId = null;
                    } else if (formData.franchiseId && formData.franchiseId.trim() !== '') {
                        updateFranchiseId = String(formData.franchiseId);
                    } else {
                        updateFranchiseId = null;
                    }
                } else {
                    updateFranchiseId = currentFranchiseId ? String(currentFranchiseId) : null;
                }
                
                const updatePayload: any = {
                    logo: customerLogo,
                    special_event_logo: logoUrl,
                    customer_id: formData.customerId || null,
                    company_id: companyId,
                    franchise_id: updateFranchiseId,
                    customer_details: customerDetails,
                    po_number: formData.poNumber || null,
                    delivery_address: formData.deliveryAddress || null, 
                    deliveryStatus: formData.deliveryStatus || null,
                    special_instructions: formData.specialInstructions || null,
                    quantity: Number(formData.quantity) || 1,
                    product_type: 'Case',
                    driver_id: formData.driverId ? Number(formData.driverId) : null,
                    driver_name: driverName,
                    driver_number: driverNumber,
                    driver_email: driverEmail,
                    unable_to_deliver_reason: formData.deliveryStatus === 'undelivered' ? unableToDeliverReason : null,
                };
                
                // Only update status_change_count if status changed
                if (statusChanged) {
                    updatePayload.status_change_count = newCount;
                }

                // Update by order_name or id
                let updateQuery = supabase.from('orders').update(updatePayload);
                if (orderId && orderId.match(/^ORD-/)) {
                    updateQuery = updateQuery.eq('order_name', orderId);
                } else if (orderId) {
                    const idNum = Number(orderId);
                    if (!Number.isNaN(idNum)) {
                        updateQuery = updateQuery.eq('id', idNum);
                    }
                }

                const { error } = await updateQuery;
                if (error) throw error;

                // If driver was newly assigned or changed in edit mode, mark that driver as Assigned
                if (driverAssignedOrChanged && formData.driverId) {
                    await updateDriverAssignmentStatus(Number(formData.driverId));
                }

                // Send notification if status changed
                if (statusChanged && orderBeforeUpdate) {
                    const oldStatus = (orderBeforeUpdate.deliveryStatus || orderBeforeUpdate.status || '').toLowerCase().trim();
                    const newStatusLower = (effectiveDeliveryStatus || '').toLowerCase().trim();
                    
                    if (oldStatus !== newStatusLower) {
                        // Use updated order with new status for notification
                        const updatedOrder = { ...orderBeforeUpdate, deliveryStatus: newStatusLower };
                        try {
                            await sendStatusChangeNotification(updatedOrder, newStatusLower);
                        } catch (notifError) {
                            console.error('Error sending notification:', notifError);
                            // Don't block order update if notification fails
                        }
                    }
                }

                const normalizedStatusForEmail = (effectiveDeliveryStatus || '').toLowerCase().trim();
                const allowedEmailStatuses = ['pending','completed','cancelled','driver assigned'];
                const shouldSendStatusEmail = statusChanged && allowedEmailStatuses.includes(normalizedStatusForEmail) && selectedCustomer?.email;
                if (shouldSendStatusEmail) {
                    try {
                        await supabase.functions.invoke('send_order_email', {
                            body: JSON.stringify({
                                to: selectedCustomer.email,
                                customer_name: selectedCustomer.company_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 'Customer',
                                order_name: orderId,
                                order_id: orderId,
                                delivery_status: effectiveDeliveryStatus,
                                quantity: formData.quantity,
                                previous_status: previousDeliveryStatus,
                                email_type: 'status_updated'
                            })
                        });
                    } catch (emailErr: any) {
                        console.error('Error sending status update email:', emailErr);
                        // Don't block order update if email fails
                    }
                }
            }

            router.push('/admin/orders');
        } catch (err) {
            console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} order:`, err);
            alert(`Failed to ${mode === 'create' ? 'create' : 'update'} order. Please try again.`);
        } finally {
            setLoading(false);
        }
    }

    const selectedCustomer = customers.find((c) => c.id === Number(formData.customerId));

    if (fetching) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading order...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">{mode === 'create' ? 'Create Order' : 'Edit Order'}</h1>
                            {mode === 'edit' && orderId && <p className="text-sm text-gray-600">{orderId}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => router.back()}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                            <Save className="w-4 h-4 mr-2" />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Information */}
                        <div className="bg-white rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <User className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold">Customer Information</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label>Customer <span className="text-red-500">*</span></Label>
                                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                        <PopoverTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                role="combobox" 
                                                className={`w-full justify-between ${errors.customerId ? 'border-red-500' : ''}`}
                                            >
                                                {selectedCustomer 
                                                    ? `${selectedCustomer.company_name} - ${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
                                                    : 'Select customer...'}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search customer..." />
                                                <CommandList>
                                                    <CommandEmpty>No customer found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {customers.map((customer) => (
                                                            <CommandItem
                                                                key={customer.id}
                                                                value={customer.company_name}
                                                                className="data-[highlighted=true]:bg-transparent data-[selected=true]:bg-transparent cursor-pointer"
                                                                onSelect={() => {
                                                                    setFormData((prev) => ({ 
                                                                        ...prev, 
                                                                        customerId: String(customer.id),
                                                                        deliveryAddress: '' // Reset address when customer changes
                                                                    }));
                                                                    setErrors((prev) => ({ ...prev, customerId: '', deliveryAddress: '' }));
                                                                    setCustomerSearchOpen(false);
                                                                    setShowNewAddressInput(false);
                                                                    // Parse customer addresses - useEffect will auto-select first address
                                                                    parseCustomerAddresses(customer.delivery_address);
                                                                    
                                                                    // Set franchise name and company name for display
                                                                    const isSuperAdmin = typeof window !== 'undefined' 
                                                                        ? localStorage.getItem('is_super_admin') === 'true'
                                                                        : false;
                                                                    
                                                                    // Find franchise name
                                                                    if (customer.franchise_id) {
                                                                        const franchise = franchises.find((f) => f.id === customer.franchise_id);
                                                                        if (franchise) {
                                                                            setDisplayFranchiseName(franchise.franchise_name);
                                                                        } else {
                                                                            setDisplayFranchiseName('');
                                                                        }
                                                                    } else if (isSuperAdmin) {
                                                                        // For super admin, show Miami if no franchise
                                                                        setDisplayFranchiseName('Miami (Primary Store)');
                                                                    } else {
                                                                        setDisplayFranchiseName('');
                                                                    }
                                                                    
                                                                    // Set company name
                                                                    if (customer.company_name) {
                                                                        setDisplayCompanyName(customer.company_name);
                                                                    } else {
                                                                        setDisplayCompanyName('');
                                                                    }
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
                                    {errors.customerId && (
                                        <p className="text-sm text-red-500 mt-1">{errors.customerId}</p>
                                    )}
                                </div>
                                
                                {/* Display Franchise Name (Read-only) */}
                                {selectedCustomer && (
                                    <div>
                                        <Label>Franchise</Label>
                                        <Input 
                                            value={displayFranchiseName || '-'}
                                            readOnly
                                            className="bg-muted cursor-not-allowed"
                                        />
                                    </div>
                                )}
                                
                                {/* Display Company Name (Read-only) */}
                                {selectedCustomer && (
                                    <div>
                                        <Label>Company</Label>
                                        <Input 
                                            value={displayCompanyName || '-'}
                                            readOnly
                                            className="bg-muted cursor-not-allowed"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Details */}
                        <div className="bg-white rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Package className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold">Order Details</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Product Type</Label>
                                    <Input
                                        value="Case"
                                        readOnly
                                        className="bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <Label>Quantity <span className="text-red-500">*</span></Label>
                                    <Input 
                                        type="number" 
                                        value={formData.quantity} 
                                        onChange={(e) => {
                                            setFormData((prev) => ({ ...prev, quantity: e.target.value }));
                                            setErrors((prev) => ({ ...prev, quantity: '' }));
                                        }}
                                        className={errors.quantity ? 'border-red-500' : ''}
                                    />
                                    {errors.quantity && (
                                        <p className="text-sm text-red-500 mt-1">{errors.quantity}</p>
                                    )}
                                </div>
                                {mode === 'create' && (
                                    <div className="col-span-2 grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Order Date <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="date"
                                                value={formData.orderDate}
                                                onChange={(e) => {
                                                    setFormData((prev) => ({ ...prev, orderDate: e.target.value }));
                                                    setErrors((prev) => ({ ...prev, orderDate: '' }));
                                                }}
                                                className={errors.orderDate ? 'border-red-500' : ''}
                                            />
                                            {errors.orderDate && (
                                                <p className="text-sm text-red-500 mt-1">{errors.orderDate}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label>Order Time <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="time"
                                                value={formData.orderTime}
                                                onChange={(e) => {
                                                    setFormData((prev) => ({ ...prev, orderTime: e.target.value }));
                                                    setErrors((prev) => ({ ...prev, orderTime: '' }));
                                                }}
                                                className={errors.orderTime ? 'border-red-500' : ''}
                                            />
                                            {errors.orderTime && (
                                                <p className="text-sm text-red-500 mt-1">{errors.orderTime}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <Label>PO Number</Label>
                                    <Input 
                                        value={formData.poNumber} 
                                        onChange={(e) => setFormData((prev) => ({ ...prev, poNumber: e.target.value }))}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Special Instructions</Label>
                                    <Textarea 
                                        value={formData.specialInstructions} 
                                        onChange={(e) => setFormData((prev) => ({ ...prev, specialInstructions: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Delivery Information */}
                        <div className="bg-white rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Truck className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold">Delivery Information</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Assign Driver</Label>
                                    <Select 
                                        value={formData.driverId} 
                                        onValueChange={(value) => setFormData((prev) => ({
                                            ...prev,
                                            driverId: value,
                                            deliveryStatus: value ? 'driver assigned' : prev.deliveryStatus,
                                        }))}
                                    >
                                        <SelectTrigger>
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
                                <div>
                                    <Label>Delivery Address <span className="text-red-500">*</span></Label>
                                    
                                    {!formData.customerId ? (
                                        <AddressAutocomplete
                                            value={formData.deliveryAddress}
                                            onChange={(value) => {
                                                setFormData((prev) => ({ ...prev, deliveryAddress: value }));
                                                setErrors((prev) => ({ ...prev, deliveryAddress: '' }));
                                            }}
                                            className={errors.deliveryAddress ? 'border-red-500' : ''}
                                            placeholder="Select customer first or enter address manually"
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            {!showNewAddressInput ? (
                                                <>
                                                    <Select
                                                        value={formData.deliveryAddress}
                                                        onValueChange={(value) => {
                                                            if (value === 'new_address') {
                                                                setShowNewAddressInput(true);
                                                                setFormData((prev) => ({ ...prev, deliveryAddress: '' }));
                                                            } else {
                                                                setFormData((prev) => ({ ...prev, deliveryAddress: value }));
                                                                setErrors((prev) => ({ ...prev, deliveryAddress: '' }));
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className={errors.deliveryAddress ? 'border-red-500' : ''}>
                                                            <SelectValue placeholder="Select address from customer's saved addresses" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {customerAddresses.length > 0 ? (
                                                                customerAddresses.map((addr, index) => (
                                                                    <SelectItem key={index} value={addr.address}>
                                                                        {addr.label} - {addr.address}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem disabled value="no_addresses">
                                                                    No saved addresses found
                                                                </SelectItem>
                                                            )}
                                                            <SelectItem value="new_address">
                                                                + Add New Address
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </>
                                            ) : (
                                                <div className="space-y-2">
                                                    <AddressAutocomplete
                                                        value={formData.deliveryAddress}
                                                        onChange={(value) => {
                                                            setFormData((prev) => ({ ...prev, deliveryAddress: value }));
                                                            setErrors((prev) => ({ ...prev, deliveryAddress: '' }));
                                                        }}
                                                        className={errors.deliveryAddress ? 'border-red-500' : ''}
                                                        placeholder="Enter new delivery address"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setShowNewAddressInput(false);
                                                            if (customerAddresses.length > 0) {
                                                                setFormData((prev) => ({ ...prev, deliveryAddress: customerAddresses[0].address }));
                                                            } else {
                                                                setFormData((prev) => ({ ...prev, deliveryAddress: '' }));
                                                            }
                                                        }}
                                                    >
                                                        <X className="w-4 h-4 mr-2" />
                                                        Cancel - Use Saved Address
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {errors.deliveryAddress && (
                                        <p className="text-sm text-red-500 mt-1">{errors.deliveryAddress}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Order Status */}
                        <div className="bg-white rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold">Order Status</h2>
                            </div>
                            <div className="space-y-4">
                                {/* Order Status - Commented out */}
                                {/* <div>
                                    <Label>Order Status</Label>
                                    <Select 
                                        value={formData.orderStatus} 
                                        onValueChange={(value) => setFormData((prev) => ({ ...prev, orderStatus: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Processing">Processing</SelectItem>
                                            <SelectItem value="Pending payment">Pending payment</SelectItem>
                                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div> */}
                                <div>
                                    <Label>Delivery Status <span className="text-red-500">*</span></Label>
                                    <Select 
                                        value={formData.deliveryStatus} 
                                        onValueChange={(value) => {
                                            // If "undelivered" is selected, open dialog
                                            if (value === 'undelivered') {
                                                setIsUnableToDeliverDialogOpen(true);
                                            } else {
                                                setFormData((prev) => ({ ...prev, deliveryStatus: value }));
                                                setErrors((prev) => ({ ...prev, deliveryStatus: '' }));
                                            }
                                        }}
                                    >
                                        <SelectTrigger className={errors.deliveryStatus ? 'border-red-500' : ''}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="processing">Processing</SelectItem>
                                            <SelectItem value="driver assigned">Driver Assigned</SelectItem>
                                            <SelectItem value="dispatched">Dispatched</SelectItem>
                                            <SelectItem value="in transit">In Transit</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="undelivered">Undelivered</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                            {/* <SelectItem value="pending payment">Pending Payment</SelectItem> */}
                                            {/* <SelectItem value="closed / paid">Closed / Paid</SelectItem> */}
                                        </SelectContent>
                                    </Select>
                                    {errors.deliveryStatus && (
                                        <p className="text-sm text-red-500 mt-1">{errors.deliveryStatus}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Note */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <span className="font-semibold">Note:</span> Changes to the order will be reflected immediately. Make sure all information is correct before saving.
                            </p>
                        </div>

                        {/* Special Event Logo */}
                        <div className="bg-white rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-2">
                                <ImageIcon className="w-5 h-5 text-gray-600" />
                                <h2 className="text-lg font-semibold">Special Event Logo</h2>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">For events with different branding (Max 5MB)</p>
                            {logoPreview ? (
                                <div className="space-y-3">
                                    <div className="w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = logoPreview;
                                            link.download = 'logo.png';
                                            link.click();
                                        }}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </Button>
                                        <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700" onClick={handleRemoveLogo}>
                                            <X className="w-4 h-4 mr-2" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <div className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                        <Upload className="w-5 h-5 text-gray-500" />
                                        <span className="text-sm text-gray-600">Upload Logo</span>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Unable to Deliver Dialog */}
            <Dialog open={isUnableToDeliverDialogOpen} onOpenChange={setIsUnableToDeliverDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Undelivered</DialogTitle>
                        <DialogDescription>
                            Please provide a reason why this order cannot be delivered.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Reason</label>
                            <textarea
                                className="w-full min-h-[150px] p-3 border border-gray-300 rounded-md"
                                placeholder="Enter reason for unable to deliver..."
                                value={unableToDeliverReason}
                                onChange={(e) => setUnableToDeliverReason(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">This reason will be saved with the order.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setIsUnableToDeliverDialogOpen(false);
                                setUnableToDeliverReason('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => {
                                setFormData((prev) => ({ ...prev, deliveryStatus: 'undelivered' }));
                                setIsUnableToDeliverDialogOpen(false);
                            }}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

