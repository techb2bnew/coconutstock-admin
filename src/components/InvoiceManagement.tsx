"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // <- your supabase client
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Download, Eye, User, MapPin, Phone, Mail, Package, DollarSign, FileText, Calendar, Plus, Upload, Send, ShoppingCart, CreditCard, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { ChevronsUpDown, Check } from "lucide-react";

const BUCKET_NAME = "invoices"; // storage bucket for invoice files
const PAGE_SIZE = 10; // invoices per page
const SEND_INVOICE_FN = "send_invoice"; // Edge function name (optional)

// --- Fixed / stricter types ---
// --- Customer type ---
type OrderCustomer = {
  id: number;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  delivery_address?: string | null;
  zone?: string | null;
};

// --- Product type (from products table) ---
type Product = {
  id: number;
  product_name?: string | null;
  sku?: string | null;
  price_per_unit?: number | null;
  price_per_case?: number | null;
  min_qty?: number | null;
  max_qty?: number | null;
  discount?: number | null;
};

// --- Order item type (each item references a product) ---
type OrderItem = {
  id: number;
  product_id?: number | null;
  quantity?: number | null;
  // nested relation from Supabase join
  products?: Product | null;
};

// --- Order type ---
type Order = {
  id: number;
  po_number?: string | null;
  order_date?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_date?: string | null;
  delivery_date?: string | null;
  amount?: number | null;
  customers?: OrderCustomer | null;
  order_items?: OrderItem[] | null;
};

// --- Payment type ---
type Payment = {
  id: number;
  method?: string | null;
  status?: string | null;
  paid_date?: string | null;
  transaction_id?: string | null;
  due_date?: string | null;
};

// --- Invoice row type (root) ---
type InvoiceRow = {
  id: number;
  file_url: string | null;
  upload_date: string | null;
  uploaded_by: string | null;
  uploaded_by_name?: string | null; // New field for storing name
  payment_status: string | null;
  total_amount: number | null;
  order_id?: number | null;
  customer_id?: number | null;
  orders?: Order | null;
  payments?: Payment[] | null;
};


export function InvoiceManagement({ locationId, locationName }: { locationId?: string; locationName?: string }) {
  // UI state (same as your design)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<"All" | "Pending" | "Paid" | "Overdue">("All");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // create form state
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [uploadedInvoiceFile, setUploadedInvoiceFile] = useState<File | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [uploadedByName, setUploadedByName] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const totalPages = Math.ceil(totalInvoices / PAGE_SIZE);

  // sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort invoices
  const sortedInvoices = [...invoices].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'invoice_id':
        aValue = a.id;
        bValue = b.id;
        break;
      case 'order_id':
        aValue = a.order_id || 0;
        bValue = b.order_id || 0;
        break;
      case 'customer':
        aValue = a.orders?.customers
          ? `${a.orders.customers.first_name ?? ""} ${a.orders.customers.last_name ?? ""}`.trim() || "-"
          : "-";
        bValue = b.orders?.customers
          ? `${b.orders.customers.first_name ?? ""} ${b.orders.customers.last_name ?? ""}`.trim() || "-"
          : "-";
        break;
      case 'po_number':
        aValue = a.orders?.po_number || "-";
        bValue = b.orders?.po_number || "-";
        break;
      case 'payment_status':
        aValue = a.payment_status || "Pending";
        bValue = b.payment_status || "Pending";
        break;
      case 'upload_date':
        aValue = a.upload_date ? new Date(a.upload_date).getTime() : 0;
        bValue = b.upload_date ? new Date(b.upload_date).getTime() : 0;
        break;
      case 'uploaded_by':
        aValue = a.uploaded_by_name || a.uploaded_by?.substring(0, 8) || "-";
        bValue = b.uploaded_by_name || b.uploaded_by?.substring(0, 8) || "-";
        break;
      default:
        return 0;
    }

    // Handle number comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    return 0;
  });

  // loading
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // current logged-in user (for uploaded_by)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // payment status color map (kept identical)
  const paymentStatusColors: Record<string, string> = {
    "Pending": "bg-yellow-100 text-yellow-800",
    "Paid": "bg-green-100 text-green-800",
    "Overdue": "bg-red-100 text-red-800"
  };

  // --- fetch current auth user email ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("User at startup:", user);
        if (!mounted) return;
        setCurrentUserId(user?.id ?? null);
      } catch (err) {
        console.error("getUser error", err);
      }
    })();
    return () => { mounted = false; };
  }, []);


  // --- fetch customers (for create dialog) ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Get franchise_id for filtering
        const currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id') 
          : null;
        const isSuperAdmin = typeof window !== 'undefined'
          ? localStorage.getItem('is_super_admin') === 'true'
          : false;

        let customerQuery = supabase.from("customers").select("*").order("company_name");
        
        // Filter by franchise_id if not super admin
        if (!isSuperAdmin && currentFranchiseId) {
          customerQuery = customerQuery.eq("franchise_id", currentFranchiseId);
        }

        const { data: custData, error } = await customerQuery;
        if (error) throw error;
        if (mounted) setCustomers(custData ?? []);
      } catch (err) {
        console.error("fetch customers error", err);
        toast.error("Failed to load customers");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // when a customer is selected, fetch that customer's orders (paginated small set)
  useEffect(() => {
    if (!selectedCustomerId) {
      setOrders([]);
      setSelectedOrderId("");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data: ordersData, error } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", selectedCustomerId)
          .order("created_at", { ascending: false })
          .limit(50); // fetch recent 50 orders for selector
        if (error) throw error;
        if (mounted) setOrders(ordersData ?? []);
      } catch (err) {
        console.error("fetch orders by customer error", err);
        toast.error("Failed to load orders for selected customer");
      }
    })();
    return () => { mounted = false; };
  }, [selectedCustomerId]);

  // --- fetch invoices (paginated, with filter) ---
  useEffect(() => {
    fetchInvoices(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeFilter]);

  async function fetchInvoices(pageNumber: number = 1) {
    setLoadingInvoices(true);
    try {
      const from = (pageNumber - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get franchise_id from localStorage for filtering
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      // Get franchise customer IDs if not super admin (for query-level filtering)
      let franchiseCustomerIds: number[] = [];
      if (!isSuperAdmin && currentFranchiseId) {
        const { data: franchiseCustomers } = await supabase
          .from("customers")
          .select("id")
          .eq("franchise_id", currentFranchiseId);
        
        franchiseCustomerIds = (franchiseCustomers || []).map(c => c.id);
      }

      // Build base query - fetch invoices first without nested relations
      let query = supabase
        .from("invoices")
        .select(
          `
    id,
    file_url,
    upload_date,
    uploaded_by,
    uploaded_by_name,
    payment_status,
    total_amount,
    order_id,
    customer_id,
    po_number,
    amount,
    created_at
  `,
          { count: "exact" }
        );

      // Apply franchise filter at query level if not super admin
      if (!isSuperAdmin && currentFranchiseId && franchiseCustomerIds.length > 0) {
        query = (query as any).in("customer_id", franchiseCustomerIds);
      } else if (!isSuperAdmin && currentFranchiseId && franchiseCustomerIds.length === 0) {
        // If franchise has no customers, return empty result
        query = (query as any).eq("customer_id", -1); // Impossible condition
      }

      // Apply payment_status filter if not "All"
      if (activeFilter && activeFilter !== "All") {
        query = (query as any).eq("payment_status", activeFilter);
      }

      query = (query as any)
        .range(from, to)
        .order("created_at", { ascending: false });

      const { data: invoicesData, error, count } = await (query as any);

      if (error) throw error;

      // Use invoicesData directly (already filtered at query level)
      let filteredInvoices = invoicesData || [];

      // Fetch orders separately for invoices that have order_id (use filtered invoices)
      const orderIds = [...new Set((filteredInvoices || []).map((inv: any) => inv.order_id).filter(Boolean))];
      
      let ordersMap: Record<number, any> = {};
      
      if (orderIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select(
            `
            id,
            po_number,
            order_date,
            payment_method,
            payment_status,
            payment_date,
            delivery_date,
            amount,
            customer_id,
            customers (
              id,
              company_name,
              first_name,
              last_name,
              email,
              phone,
              delivery_address
            )
          `
          )
          .in("id", orderIds);

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
        } else {
          // Create a map of orders by id
          ordersMap = (ordersData || []).reduce((acc: Record<number, any>, order: any) => {
            acc[order.id] = order;
            return acc;
          }, {});
        }

        // Fetch order_items for all orders
        const { data: orderItemsData, error: itemsError } = await supabase
          .from("order_items")
          .select(
            `
            id,
            order_id,
            product_id,
            quantity,
            products (
              id,
              product_name,
              product_type,
              price_per_case,
              price_per_unit,
              min_qty,
              max_qty,
              discount
            )
          `
          )
          .in("order_id", orderIds);

        if (itemsError) {
          console.error("Error fetching order items:", itemsError);
        } else {
          // Group order items by order_id
          const itemsByOrderId = (orderItemsData || []).reduce((acc: Record<number, any[]>, item: any) => {
            if (!acc[item.order_id]) {
              acc[item.order_id] = [];
            }
            acc[item.order_id].push({
              ...item,
              products: Array.isArray(item.products) ? item.products[0] : item.products,
            });
            return acc;
          }, {});

          // Attach order_items to orders
          Object.keys(ordersMap).forEach((orderIdStr) => {
            const orderId = parseInt(orderIdStr);
            if (ordersMap[orderId]) {
              ordersMap[orderId].order_items = itemsByOrderId[orderId] || [];
            }
          });
        }
      }

      // Map invoices with their orders (use filtered invoices)
      const mappedInvoices: InvoiceRow[] = (filteredInvoices || []).map((row: any) => ({
        id: row.id,
        file_url: row.file_url,
        upload_date: row.upload_date,
        uploaded_by: row.uploaded_by,
        uploaded_by_name: row.uploaded_by_name || null,
        payment_status: row.payment_status,
        total_amount: row.total_amount,
        order_id: row.order_id,
        customer_id: row.customer_id,
        orders: row.order_id && ordersMap[row.order_id] ? ordersMap[row.order_id] : null,
        payments: [],
      }));

      setInvoices(mappedInvoices);
      // Update total count based on filtered results
      setTotalInvoices(mappedInvoices.length);
      setPage(pageNumber);
    } catch (err) {
      console.error("fetchInvoices error:", err);
      toast.error("Failed to load invoices");
    } finally {
      setLoadingInvoices(false);
    }
  }


  // --- view / download handlers ---
  const handleViewInvoice = async (invoice: InvoiceRow) => {
    try {
      const [custRes, orderRes] = await Promise.all([
        invoice.customer_id ? supabase.from("customers").select("*").eq("id", invoice.customer_id).limit(1) : Promise.resolve({ data: [], error: null }),
        invoice.order_id ? supabase.from("orders").select("*").eq("id", invoice.order_id).limit(1) : Promise.resolve({ data: [], error: null })
      ]);
      const customer = custRes.data?.[0] ?? null;
      const order = orderRes.data?.[0] ?? null;

      const extended: any = { ...invoice, customer, order };
      setSelectedInvoice(extended as any);
      setIsViewDialogOpen(true);
    } catch (err) {
      console.error("view invoice fetch error", err);
      toast.error("Failed to load invoice details");
    }
  };

  const handleDownloadInvoice = (invoice: InvoiceRow) => {
    if (!invoice.file_url) {
      toast.error("No file available for download");
      return;
    }
    window.open(invoice.file_url, "_blank", "noopener");
    toast.success("Downloading invoice...");
  };

  // --- file input handling for create dialog ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    // basic validation
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      toast.error("File too large. Max 10MB.");
      return;
    }
    setUploadedInvoiceFile(file);
  };

  // --- create & upload invoice ---
  const handleSendInvoice = async () => {
    if (!selectedCustomerId || !selectedOrderId || !uploadedInvoiceFile) {
      toast.error("Please complete all steps");
      return;
    }
    setCreatingInvoice(true);

    try {
      console.log("🧾 Starting invoice upload process...");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        console.error(" Auth fetch error:", userErr);
        throw new Error("User not authenticated — please log in again.");
      }
      const activeUserId = userData.user.id;

      // 1️⃣ Upload file
      const timestamp = Date.now();
      const filenameSafe = uploadedInvoiceFile.name.replace(/\s+/g, "-");
      const path = `invoice-${timestamp}-${filenameSafe}`;

      const uploadRes = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, uploadedInvoiceFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadRes.error) {
        console.error("Upload error:", uploadRes.error);
        throw uploadRes.error;
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadRes.data.path);
      // if (urlErr) throw urlErr;
      const publicUrl = urlData.publicUrl;

      const insertPayload: any = {
        order_id: selectedOrderId,
        customer_id: selectedCustomerId,
        total_amount: null,
        payment_status: "Pending",
        created_at: new Date().toISOString(),
        uploaded_by: activeUserId, // Keep UUID for RLS compliance
        file_url: publicUrl,
      };

      // Add uploaded_by_name if name is provided (assuming this column exists or will be added)
      if (uploadedByName) {
        insertPayload.uploaded_by_name = uploadedByName;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("invoices")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setPage(1);
      await fetchInvoices(1);

      toast.success("Invoice uploaded and record created");

      // 5️⃣ Optional: send email
      try {
        // Fetch customer details for email
        const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));
        const customerEmail = selectedCustomer?.email;
        const customerName = selectedCustomer?.company_name || 
                            `${selectedCustomer?.first_name || ""} ${selectedCustomer?.last_name || ""}`.trim() ||
                            "Customer";

        if (!customerEmail) {
          console.warn("Customer email not found, skipping email send");
          toast.info("Invoice created but email not sent (customer email missing)");
        } else {
          await supabase.functions.invoke(SEND_INVOICE_FN, {
            body: JSON.stringify({
              to: customerEmail,
              public_url: publicUrl,
              customer_name: customerName,
              invoice_id: inserted.id,
              order_id: selectedOrderId,
            }),
          });
          toast.success("Invoice email sent successfully");
        }
      } catch (fnErr: any) {
        console.error("Send invoice function error:", fnErr);
        // Don't show error toast if it's just a missing function
        if (fnErr?.message?.includes("function") || fnErr?.message?.includes("404")) {
          toast.info("Invoice created (email function not configured)");
        } else {
          toast.error("Invoice created but email failed: " + (fnErr?.message || "Unknown error"));
        }
      }

      setIsCreateDialogOpen(false);
      setSelectedCustomerId("");
      setSelectedOrderId("");
      setUploadedInvoiceFile(null);
      setUploadedByName("");
    } catch (err: any) {
      console.error(" send invoice error:", err);
      toast.error(err?.message || "Failed to create invoice");
    } finally {
      setCreatingInvoice(false);
    }
  };


  // filter client-side for badge counts (we already fetch from server with payment_status filter — but UI buttons keep same behaviour)
  const totalFilteredCount = invoices.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl mb-2">Invoice Management</h1>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant={activeFilter === "All" ? "default" : "outline"} onClick={() => { setActiveFilter("All"); setPage(1); }}>
            All Invoices
          </Button>
          <Button variant={activeFilter === "Pending" ? "default" : "outline"} onClick={() => { setActiveFilter("Pending"); setPage(1); }}>
            Pending
          </Button>
          <Button variant={activeFilter === "Paid" ? "default" : "outline"} onClick={() => { setActiveFilter("Paid"); setPage(1); }}>
            Paid
          </Button>
          <Button variant={activeFilter === "Overdue" ? "default" : "outline"} onClick={() => { setActiveFilter("Overdue"); setPage(1); }}>
            Overdue
          </Button>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Upload & Invoice
        </Button>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeFilter === "All" ? "All Invoices" : `${activeFilter} Invoices`} ({totalInvoices})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('invoice_id')}>
                  <div className="flex items-center gap-2">
                    <span>Invoice ID</span>
                    {sortColumn === 'invoice_id' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('order_id')}>
                  <div className="flex items-center gap-2">
                    <span>Order ID</span>
                    {sortColumn === 'order_id' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-2">
                    <span>Customer</span>
                    {sortColumn === 'customer' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('po_number')}>
                  <div className="flex items-center gap-2">
                    <span>PO Number</span>
                    {sortColumn === 'po_number' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                {/* <TableHead>Amount</TableHead> */}
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('payment_status')}>
                  <div className="flex items-center gap-2">
                    <span>Payment Status</span>
                    {sortColumn === 'payment_status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('upload_date')}>
                  <div className="flex items-center gap-2">
                    <span>Upload Date</span>
                    {sortColumn === 'upload_date' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('uploaded_by')}>
                  <div className="flex items-center gap-2">
                    <span>Uploaded By</span>
                    {sortColumn === 'uploaded_by' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.length > 0 ? (
                sortedInvoices.map((invoice) => {
                  const orderAmount = invoice.orders?.amount;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                      <TableCell className="font-mono text-sm">{invoice.order_id ?? "-"}</TableCell>
                      <TableCell className="text-sm">
                        {invoice.orders?.customers
                          ? `${invoice.orders.customers.first_name ?? ""} ${invoice.orders.customers.last_name ?? ""}`.trim() || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.orders?.po_number ?? "-"}</TableCell>
                      {/* <TableCell>
                        {typeof orderAmount === "number" ? `$${orderAmount.toFixed(2)}` : "$0.00"}
                      </TableCell> */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${(invoice.payment_status &&
                              paymentStatusColors[invoice.payment_status]) ||
                            "bg-slate-100 text-slate-800"
                            }`}
                        >
                          {invoice.payment_status ?? "Pending"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.upload_date
                          ? new Date(invoice.upload_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.uploaded_by_name || invoice.uploaded_by?.substring(0, 8) + "..." || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-slate-500 py-6 text-sm"
                  >
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

          </Table>

          {/* Pagination controls (simple) */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-600">
              Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, totalInvoices)} of {totalInvoices}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Prev
              </Button>
              <div className="text-sm">Page {page} / {totalPages || 1}</div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice Details</span>
              {selectedInvoice && (
                <Badge className={`${paymentStatusColors[selectedInvoice.payment_status ?? "Pending"]}`}>
                  {selectedInvoice.payment_status ?? "Pending"}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice && (
                <>
                  <span className="font-mono">{selectedInvoice.id}</span>
                  <span> • </span>
                  <span>Order: {selectedInvoice.order_id}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
              <div className="space-y-6">
                {/* Invoice Info */}
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <span className="font-medium">Invoice Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Invoice ID</div>
                      <div className="font-mono font-medium">{selectedInvoice.id}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Upload Date</div>
                      <div>{selectedInvoice.upload_date ? new Date(selectedInvoice.upload_date).toLocaleDateString() : "-"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Uploaded By</div>
                      <div>{selectedInvoice.uploaded_by_name || selectedInvoice.uploaded_by?.substring(0, 8) + "..." || "-"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">File URL</div>
                      {selectedInvoice.file_url ? (
                        <a href={selectedInvoice.file_url} target="_blank" rel="noreferrer" className="text-sky-600 underline">View File</a>
                      ) : (
                        <span className="text-slate-500">No file</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                {selectedInvoice.orders?.customers && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-sky-600" />
                      <span className="font-medium">Customer Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-slate-500">Company</div>
                        <div className="font-medium">{selectedInvoice.orders?.customers?.company_name}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Contact Person</div>
                        <div>{selectedInvoice.orders?.customers?.first_name ?? ""} {selectedInvoice.orders?.customers?.last_name ?? ""}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Email</div>
                        <div>{selectedInvoice.orders?.customers?.email}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Phone</div>
                        <div>{selectedInvoice.orders?.customers?.phone}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-slate-500">Address</div>
                        <div>{selectedInvoice.orders?.customers?.delivery_address}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedInvoice.orders?.order_items?.length ? (
                  <div className="mt-6">
                    <div className="bg-slate-50 rounded-lg p-4">
                      {/* 🔹 Title inside card */}
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-sky-600" />
                        <span className="font-medium text-slate-800">Order Items</span>
                      </div>

                      <div className="space-y-3">
                        {selectedInvoice.orders.order_items.map((item: OrderItem) => {
                          const product = item.products;
                          const quantity = item.quantity ?? 0;

                          // Determine correct price
                          const price =
                            product?.price_per_unit ??
                            product?.price_per_case ??
                            0;

                          // Calculate total
                          const total = quantity * price;

                          // Label for clarity
                          const priceLabel = product?.price_per_unit
                            ? "per unit"
                            : product?.price_per_case
                              ? "per case"
                              : "";

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between border border-slate-200 rounded-lg p-3 bg-white"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm text-slate-800">
                                  {product?.product_name ?? "Unnamed Product"}
                                </div>

                                {product?.sku && (
                                  <div className="text-xs text-slate-500">
                                    SKU: {product.sku}
                                  </div>
                                )}

                                <div className="text-xs text-slate-600 mt-1">
                                  Quantity: {quantity} × ${price.toFixed(2)} {priceLabel}
                                </div>
                              </div>

                              <div className="font-semibold text-slate-700">
                                ${total.toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}




                {/* Order Info */}
                {selectedInvoice.orders && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingCart className="w-4 h-4 text-sky-600" />
                      <span className="font-medium">Order Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-slate-500">Order ID</div><div>{selectedInvoice.orders.id}</div></div>
                      <div><div className="text-slate-500">PO Number</div><div>{selectedInvoice.orders.po_number}</div></div>
                      <div><div className="text-slate-500">Order Date</div><div>{selectedInvoice.orders.order_date ? new Date(selectedInvoice.orders.order_date).toLocaleDateString() : "-"}</div></div>
                      <div><div className="text-slate-500">Delivery Date</div><div>{selectedInvoice.orders.delivery_date ? new Date(selectedInvoice.orders.delivery_date).toLocaleDateString() : "-"}</div></div>
                      <div><div className="text-slate-500">Order Amount</div><div>{typeof selectedInvoice.orders.amount === 'number' ? `$${selectedInvoice.orders.amount.toFixed(2)}` : "$0.00"}</div></div>
                    </div>
                  </div>
                )}

                {/* {selectedInvoice?.orders && (
                  <div className="bg-slate-50 rounded-lg p-4 mt-6">
                     
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-sky-600" />
                      <span className="font-medium">Price Breakdown</span>
                    </div>

                    {(() => {
                      const orderItems = selectedInvoice.orders.order_items || [];

                      // --- Price calculations ---
                      let subtotal = 0;
                      let totalDiscount = 0;
                      let tax = 0;
                      let deliveryFee = 0;

                      orderItems.forEach((item: any) => {
                        const product = item.products;
                        const quantity = item.quantity ?? 0;

                        // Choose price based on whichever exists
                        const price =
                          product?.price_per_unit ??
                          product?.price_per_case ??
                          0;

                        const itemSubtotal = quantity * price;
                        const itemDiscount =
                          product?.discount ? (itemSubtotal * product.discount) / 100 : 0;

                        subtotal += itemSubtotal;
                        totalDiscount += itemDiscount;
                      });

                      const total = subtotal - totalDiscount + tax + deliveryFee;

                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                          </div>

                          {tax > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Tax</span>
                              <span className="font-medium">${tax.toFixed(2)}</span>
                            </div>
                          )}

                          {deliveryFee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Delivery Fee</span>
                              <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                            </div>
                          )}

                          {totalDiscount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount</span>
                              <span>- ${totalDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          <Separator />

                          <div className="flex justify-between pt-2">
                            <span className="font-semibold">Total Amount</span>
                            <span className="font-bold text-xl text-sky-600">
                              ${total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )} */}



                {/* Order Items */}
                {selectedInvoice.orders?.order_items && selectedInvoice.orders.order_items.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-sky-600" />
                      <span className="font-medium">Order Items</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product ID</TableHead>
                          <TableHead>Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.orders.order_items.map((item: OrderItem) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product_id}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* <div>
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-sky-600" />
                    <span className="font-medium">Price Breakdown</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-medium">$52</span>
                    </div>
                    {selectedInvoice.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Tax</span>
                        <span className="font-medium">${selectedInvoice.tax.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInvoice.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Delivery Fee</span>
                        <span className="font-medium">${selectedInvoice.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-${selectedInvoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between pt-2">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-xl text-sky-600">${selectedInvoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div> */}

                {/* Payment Info (from orders) */}
                {selectedInvoice.orders && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-sky-600" />
                      <span className="font-medium">Payment Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-slate-500">Method</div><div>{selectedInvoice.orders.payment_method ?? "-"}</div></div>
                      <div><div className="text-slate-500">Status</div><div>{selectedInvoice.orders.payment_status ?? "-"}</div></div>
                      <div><div className="text-slate-500">Paid Date</div><div>{selectedInvoice.orders.payment_date ?? "-"}</div></div>
                    </div>
                  </div>
                )}
              </div>


              {selectedInvoice?.orders && (
                <div className="bg-slate-50 rounded-lg p-4 mt-6">
                  {/* Section Header Inside Box */}
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    <span className="font-medium">Order Timeline</span>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Order Date</div>
                      <div className="font-medium">
                        {selectedInvoice.orders.order_date
                          ? new Date(selectedInvoice.orders.order_date).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Delivery Date</div>
                      <div className="font-medium">
                        {selectedInvoice.orders.delivery_date
                          ? new Date(selectedInvoice.orders.delivery_date).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>

                    {selectedInvoice.orders.payment_date && (
                      <div>
                        <div className="text-slate-500">Payment Date</div>
                        <div className="font-medium">
                          {new Date(selectedInvoice.orders.payment_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </ScrollArea>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => selectedInvoice && handleDownloadInvoice(selectedInvoice)}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setSelectedCustomerId("");
          setSelectedOrderId("");
          setUploadedInvoiceFile(null);
          setUploadedByName("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create & Send Invoice</DialogTitle>
            <DialogDescription>
              Select customer, order, upload invoice and send
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Select Customer */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-sky-700">1</span>
                </div>
                <Label className="text-base">Select Customer</Label>
              </div>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={customerSearchOpen} className="w-full justify-between">
                    {selectedCustomerId ? (customers.find(c => String(c.id) === String(selectedCustomerId))?.company_name ?? selectedCustomerId) : "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem key={customer.id} value={customer.company_name} onSelect={() => {
                            setSelectedCustomerId(String(customer.id));
                            setSelectedOrderId("");
                            setCustomerSearchOpen(false);
                          }}>
                            <Check className={`mr-2 h-4 w-4 ${String(selectedCustomerId) === String(customer.id) ? "opacity-100" : "opacity-0"}`} />
                            <div>
                              <div>{customer.company_name}</div>
                              <div className="text-xs text-slate-500">{customer.first_name ?? ""} {customer.last_name ?? ""} • {customer.email}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Step 2: Select Order */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-sky-700">2</span>
                </div>
                <Label className="text-base">Select Order</Label>
              </div>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId} disabled={!selectedCustomerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selectedCustomerId ? "Select order..." : "Select customer first"} />
                </SelectTrigger>
                <SelectContent>
                  {orders.length === 0 && selectedCustomerId && <SelectItem value="no-orders" disabled>No orders found</SelectItem>}
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={String(order.id)}>
                      {order.order_name ?? order.id} - {order.order_date ? new Date(order.order_date).toLocaleDateString() : ""} - ${order.amount ?? 0} - {order.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOrderId && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Order ID:</span>
                      <span className="ml-2 font-mono font-medium">{selectedOrderId}</span>
                    </div>
                    {/* <div>
                      <span className="text-slate-500">Amount:</span>
                      <span className="ml-2 font-semibold">
                        ${orders.find(o => String(o.id) === String(selectedOrderId))?.amount ?? "0.00"}
                      </span>
                    </div> */}
                    <div>
                      <span className="text-slate-500">Date:</span>
                      <span className="ml-2">
                        {orders.find(o => String(o.id) === String(selectedOrderId))?.order_date ? new Date(orders.find(o => String(o.id) === String(selectedOrderId))!.order_date).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Status:</span>
                      <span className="ml-2">{orders.find(o => String(o.id) === String(selectedOrderId))?.status ?? "-"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Upload Invoice */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-sky-700">3</span>
                </div>
                <Label className="text-base">Upload Invoice File</Label>
              </div>

              {uploadedInvoiceFile ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{uploadedInvoiceFile.name}</div>
                      <div className="text-xs text-slate-500">
                        {(uploadedInvoiceFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setUploadedInvoiceFile(null)}>Remove</Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-700">Click to upload invoice</span>
                    <span className="text-xs text-slate-500 mt-1">PDF, PNG, JPG up to 10MB</span>
                  </div>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} disabled={!selectedOrderId} />
                </label>
              )}
            </div>

            {/* Step 4: Enter Uploaded By */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-sky-700">4</span>
                </div>
                <Label className="text-base">Enter Uploaded By</Label>
              </div>
              <Input
                type="text"
                placeholder="Uploaded By"
                value={uploadedByName}
                onChange={(e) => setUploadedByName(e.target.value)}
                disabled={!selectedOrderId}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendInvoice} disabled={!selectedCustomerId || !selectedOrderId || !uploadedInvoiceFile || creatingInvoice}>
              <Send className="w-4 h-4 mr-2" />
              {creatingInvoice ? "Sending..." : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
