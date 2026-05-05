// OrderDetailsView.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  Truck,
  CheckCircle,
  Clock,
  FileText,
  UserPlus,
  Check,
  Image as ImageIcon,
  Upload,
  Send,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface OrderDetailsViewProps {
  orderId: string;
  onBack: () => void;
}

type SupaOrder = {
  id: number;
  order_name: string | null;
  logo: string | null;
  special_event_logo: string | null;
  customer_id: number | null;
  product_id: number | null;
  po_number: string | null;
  order_date: string | null;
  delivery_date: string | null;
  status: string | null;
  deliveryStatus: string | null;
  driver_id: number | null;
  amount: number | null;
  franchise_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  delivery_address?: any;
  quantity?: number | null;
  unable_to_deliver_reason?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  notes?: string | null;
};

export function OrderDetailsView({ orderId, onBack }: OrderDetailsViewProps) {
  // local state
  const [order, setOrder] = useState<SupaOrder | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [franchise, setFranchise] = useState<any | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [openUpdateStatus, setOpenUpdateStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | "">("");
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceEmail, setInvoiceEmail] = useState<string>("");
  const [isUnableToDeliverDialogOpen, setIsUnableToDeliverDialogOpen] = useState(false);
  const [unableToDeliverReason, setUnableToDeliverReason] = useState("");

  // pagination for drivers list in dialog
  const [driversPage, setDriversPage] = useState(1);
  const driversPageSize = 6;
  const [driversTotal, setDriversTotal] = useState(0);

  // derived helper for status UI color (matching OrderManagement component)
  const getStatusColor = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "processing":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ready":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  // Helper function to capitalize first letter of each word
  const formatStatusText = (status: string | null): string => {
    if (!status) return "Pending";
    return status
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // fetch single order by order_name first, fallback to id
  async function fetchOrderDetails() {
    setLoading(true);
    try {
      // try by order_name
      let orderRes = await supabase
        .from("orders")
        .select("*")
        .eq("order_name", orderId)
        .limit(1);

      if (!orderRes.data || orderRes.data.length === 0) {
        // fallback: try by numeric id
        const idNum = Number(orderId);
        if (!Number.isNaN(idNum)) {
          orderRes = await supabase.from("orders").select("*").eq("id", idNum).limit(1);
        }
      }

      const found = (orderRes.data && orderRes.data[0]) || null;
      if (!found) {
        toast.error("Order not found");
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(found);
      setNewStatus(found.deliveryStatus || found.status || "Processing");
      // Load unable to deliver reason if exists
      if (found.unable_to_deliver_reason) {
        setUnableToDeliverReason(found.unable_to_deliver_reason);
      }
      // fetch customer
      let customerData: any = null;
      if (found.customer_id) {
        const cust = await supabase.from("customers").select("*").eq("id", found.customer_id).single();
        customerData = cust.data || null;
        setCustomer(customerData);
        setInvoiceEmail((customerData && (customerData.email || "")) || "");
      } else {
        setCustomer(null);
      }

      let franchiseId: string | null = (found as any).franchise_id || null;
      if (!franchiseId && customerData && customerData.franchise_id) {
        franchiseId = customerData.franchise_id;
      }

      if (franchiseId) {
        try {
          const { data: franchiseData, error: franchiseError } = await supabase
            .from("franchises")
            .select("id, franchise_name")
            .eq("id", franchiseId)
            .maybeSingle();

          if (!franchiseError) {
            setFranchise(franchiseData || null);
          } else {
            setFranchise(null);
          }
        } catch (err) {
          console.error("Error fetching franchise:", err);
          setFranchise(null);
        }
      } else {
        setFranchise(null);
      }

      // fetch status history - if you have a dedicated table you can pull it; else build from audit columns.
      // Attempt to fetch from a table "order_status_history" if it exists; otherwise mock a minimal history.
      try {
        const sh = await supabase.from("order_status_history").select("*").eq("order_id", found.id).order("created_at", { ascending: true }).limit(50);
        if (sh.data && sh.data.length > 0 && !sh.error) {
          setStatusHistory(sh.data);
        } else {
          // fallback minimal history (order created)
          const currentStatus = found.deliveryStatus || found.status;
          setStatusHistory([
            { status: "Order Placed", timestamp: found.created_at || found.order_date || new Date().toISOString(), description: "Order created" },
            ...(currentStatus && currentStatus !== "Pending" ? [{ status: currentStatus, timestamp: found.updated_at || new Date().toISOString(), description: `Current status: ${currentStatus}` }] : [])
          ]);
        }
      } catch (err) {
        // Table doesn't exist, use fallback
        console.log("order_status_history table not available, using fallback");
        const currentStatus = found.deliveryStatus || found.status;
        setStatusHistory([
          { status: "Order Placed", timestamp: found.created_at || found.order_date || new Date().toISOString(), description: "Order created" },
          ...(currentStatus && currentStatus !== "Pending" ? [{ status: currentStatus, timestamp: found.updated_at || new Date().toISOString(), description: `Current status: ${currentStatus}` }] : [])
        ]);
      }

      // Fetch the assigned driver if driver_id exists
      if (found.driver_id) {
        try {
          const { data: driverData, error: driverError } = await supabase
            .from("drivers")
            .select("*")
            .eq("id", found.driver_id)
            .single();
          
          if (!driverError && driverData) {
            setDrivers([driverData]);
          }
        } catch (err) {
          console.error("Error fetching driver:", err);
        }
      }
    } catch (err) {
      console.error("fetchOrderDetails error", err);
      toast.error("Failed to load order");
    } finally {
      setLoading(false);
    }
  }


  // fetch paginated drivers
  async function fetchDrivers(page = 1) {
    const from = (page - 1) * driversPageSize;
    const to = from + driversPageSize - 1;
    try {
      // Get franchise_id for filtering
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null;
      const isSuperAdmin = typeof window !== 'undefined'
        ? localStorage.getItem('is_super_admin') === 'true'
        : false;

      let query = supabase
        .from("drivers")
        .select("*", { count: "exact" });

      // Filter by franchise_id if not super admin
      if (!isSuperAdmin && currentFranchiseId) {
        query = query.eq('franchise_id', currentFranchiseId);
      }

      const res = await query
        .range(from, to)
        .order("id", { ascending: true });

      setDrivers(res.data || []);
      setDriversTotal(res.count || 0);
    } catch (err) {
      console.error("fetchDrivers error", err);
    }
  }

  // upload invoice file to storage and return public path
  async function uploadInvoiceFile(file: File) {
    try {
      // Verify user is authenticated before storage upload (required for storage RLS policy)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        console.error("Auth error before storage upload:", userErr);
        toast.error("Authentication required for file upload");
        return null;
      }

      const timestamp = Date.now();
      // Use same path pattern as InvoiceManagement (simpler path structure)
      const filenameSafe = file.name.replace(/\s+/g, "-");
      const path = `invoice-${timestamp}-${filenameSafe}`;
      
      const res = await supabase.storage
        .from("invoices")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false, // Don't overwrite existing files
        });
        
      if (res.error) {
        console.error("storage upload error", res.error);
        console.error("Storage error details:", {
          message: res.error.message,
          name: res.error.name,
          statusCode: (res.error as any).statusCode
        });
        toast.error("Invoice upload failed: " + res.error.message);
        return null;
      }
      
      // get public url (or signed URL)
      const { data: publicData } = supabase.storage.from("invoices").getPublicUrl(res.data.path);
      const publicUrl = publicData?.publicUrl || null;
      return { path: res.data.path, publicUrl };
    } catch (err) {
      console.error("uploadInvoiceFile error", err);
      toast.error("Invoice upload error");
      return null;
    }
  }

  // send invoice: upload then call Edge Function to email
  async function handleSendInvoice() {
    if (!invoiceFile) {
      toast.error("Select a PDF first");
      return;
    }
    if (!invoiceEmail || !invoiceEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    if (!order) {
      toast.error("Order not loaded");
      return;
    }

    try {
      console.log("🧾 Starting invoice upload process...");

      // Get current authenticated user - use getUser() like InvoiceManagement component (which works)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        console.error(" Auth fetch error:", userErr);
        toast.error("User not authenticated — please log in again.");
        return;
      }
      const activeUserId = userData.user.id;

      // Ensure session is available for storage RLS policy
      // Storage requests need the session token in the Authorization header
      const { data: sessionCheck, error: sessionCheckErr } = await supabase.auth.getSession();
      if (sessionCheckErr || !sessionCheck?.session) {
        console.error("Session not available for storage upload:", sessionCheckErr);
        toast.error("Session expired. Please refresh the page and try again.");
        return;
      }

      console.log("Session available for storage:", {
        has_session: !!sessionCheck.session,
        user_id: sessionCheck.session.user.id,
        access_token_present: !!sessionCheck.session.access_token
      });

      toast("Uploading invoice...", { description: "Please wait..." });
      
      // Upload file - EXACT same pattern as InvoiceManagement component
      const timestamp = Date.now();
      // Sanitize filename - remove special characters that might cause issues
      const filenameSafe = invoiceFile.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9.-]/g, "")
        .toLowerCase();
      const path = `invoice-${timestamp}-${filenameSafe}`;
      
      console.log("Uploading to path:", path);
      
      // Ensure we have a valid session before upload
      const { data: uploadSession, error: uploadSessionErr } = await supabase.auth.getSession();
      if (uploadSessionErr || !uploadSession?.session) {
        console.error("No session for storage upload:", uploadSessionErr);
        toast.error("Session expired. Please refresh and try again.");
        return;
      }
      
      const uploadRes = await supabase.storage
        .from("invoices")
        .upload(path, invoiceFile, {
          cacheControl: "3600",
          upsert: false,
        });
      
      if (uploadRes.error) {
        console.error("Upload error:", uploadRes.error);
        console.error("Upload error details:", {
          message: uploadRes.error.message,
          name: uploadRes.error.name,
          statusCode: (uploadRes.error as any).statusCode
        });
        
        // More specific error messages
        const errorMessage = uploadRes.error.message || '';
        const statusCode = (uploadRes.error as any).statusCode;
        
        if (statusCode === '403' || statusCode === 403 || errorMessage.includes('row-level security') || errorMessage.includes('Unauthorized')) {
          toast.error("Permission denied. Please check storage bucket permissions or contact administrator.");
        } else if (statusCode === '400' || statusCode === 400) {
          toast.error("Invalid file or path. Please try with a different filename.");
        } else {
          toast.error("Invoice upload failed: " + errorMessage);
        }
        return;
      }
      
      const { data: urlData } = supabase.storage
        .from("invoices")
        .getPublicUrl(uploadRes.data.path);
      const publicUrl = urlData.publicUrl;
      
      toast.dismiss();

      // Match InvoiceManagement payload structure exactly
      const insertPayload: any = {
        order_id: order.id,
        customer_id: order.customer_id,
        total_amount: null, // Match InvoiceManagement exactly
        payment_status: "Pending",
        created_at: new Date().toISOString(),
        uploaded_by: activeUserId, // Use activeUserId directly like InvoiceManagement
        file_url: publicUrl,
      };

      // Add optional fields if they exist
      if (order.po_number) {
        insertPayload.po_number = order.po_number;
      }

      // Verify session one more time right before insert
      const { data: finalSession, error: finalSessionErr } = await supabase.auth.getSession();
      if (finalSessionErr || !finalSession?.session) {
        console.error("Final session check failed:", finalSessionErr);
        toast.error("Session expired. Please log in again.");
        return;
      }

      // Test that RLS is working by checking if we can read invoices (this verifies auth.uid() is available)
      const { data: testRead, error: testErr } = await supabase
        .from("invoices")
        .select("id")
        .limit(1);
      
      if (testErr && testErr.code === '42501') {
        console.error("RLS test failed - auth.uid() not available:", testErr);
        toast.error("Authentication issue detected. Please refresh the page and try again.");
        return;
      }

      console.log("Inserting invoice with payload:", {
        order_id: insertPayload.order_id,
        customer_id: insertPayload.customer_id,
        uploaded_by: insertPayload.uploaded_by,
        uploaded_by_type: typeof insertPayload.uploaded_by,
        has_session: !!finalSession?.session,
        session_user_id: finalSession?.session?.user?.id,
        session_expires_at: finalSession?.session?.expires_at,
      });

      const { data: insertedInvoice, error: insertErr } = await supabase
        .from("invoices")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error("Invoice insert error:", insertErr);
        console.error("Error details:", {
          message: insertErr.message,
          details: insertErr.details,
          hint: insertErr.hint,
          code: insertErr.code,
          uploaded_by_in_payload: insertPayload.uploaded_by,
          uploaded_by_type: typeof insertPayload.uploaded_by
        });
        
        // More user-friendly error message
        if (insertErr.code === '42501' || insertErr.message?.includes('row-level security')) {
          toast.error("Permission denied. Please ensure you're logged in and have permission to create invoices.");
        } else {
          toast.error("Failed to create invoice record: " + insertErr.message);
        }
        return;
      }

      toast.success("Invoice created successfully!");

      // Send invoice email to customer via send_invoice Edge Function
      try {
        const fn = await supabase.functions.invoke("send_invoice", {
          body: {
            order_id: order.id,
            invoice_id: insertedInvoice?.id,
            file_path: uploadRes.data.path,
            public_url: publicUrl,
            to: invoiceEmail,
            customer_name: customer?.company_name || `${customer?.first_name} ${customer?.last_name}`,
            order_name: order.order_name || `#${order.id}`,
          },
        });

        if (!fn.error) {
          toast.success("Invoice email sent to customer!");
        } else {
          console.log("Email function error (non-fatal):", fn.error);
          // Invoice is created, email is optional
          toast.success("Invoice created successfully. Email could not be sent.");
        }
      } catch (fnErr: any) {
        // Silently handle - Edge Function might not be deployed yet
        console.log("Email function not available (this is okay):", fnErr);
        toast.success("Invoice created successfully. Email service not configured.");
      }
      setIsInvoiceDialogOpen(false);
      setInvoiceFile(null);
    } catch (err) {
      console.error("handleSendInvoice error", err);
      toast.error("Failed to send invoice");
    }
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
  const sendStatusChangeNotification = async (order: SupaOrder, newStatus: string) => {
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

  // update order status in DB
  async function handleStatusUpdate() {
    if (!order) return;
    try {
      // Get old status before updating
      const oldStatus = (order.deliveryStatus || order.status || '').toLowerCase();
      const newStatusLower = newStatus.toLowerCase();
      
      // If status is "undelivered", open dialog instead of updating directly
      if (newStatusLower === 'undelivered') {
        setIsUnableToDeliverDialogOpen(true);
        return;
      }
      
      // Increment status_change_count only if status changed
      const statusChanged = oldStatus !== newStatusLower;
      const currentCount = Number((order as any).status_change_count) || 1;
      const newCount = statusChanged ? currentCount + 1 : currentCount;
      
      const updatePayload: any = {
        deliveryStatus: newStatusLower,
        unable_to_deliver_reason: null, // Clear reason if status changed away from undelivered
      };
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount;
      }
      
      const { error } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      if (error) {
        console.error("status update error", error);
        toast.error("Failed to update status");
        return;
      }
      
      // Send notification if status changed
      if (oldStatus !== newStatusLower) {
        await sendStatusChangeNotification(order, newStatusLower);
      }
      
      // optionally insert into status history table if exists (silently fail if table doesn't exist)
      try {
        await supabase.from("order_status_history").insert({ order_id: order.id, status: newStatusLower });
      } catch (err) {
        // Table doesn't exist, that's okay
        console.log("order_status_history table not available");
      }
      // refresh
      await fetchOrderDetails();
      setOpenUpdateStatus(false);
      toast.success("Status updated");
    } catch (err) {
      console.error("handleStatusUpdate error", err);
      toast.error("Failed to update status");
    }
  }

  // Save unable to deliver status with reason
  async function handleSaveUnableToDeliver() {
    if (!order) return;
    try {
      // Get old status before updating
      const oldStatus = (order.deliveryStatus || order.status || '').toLowerCase();
      const newStatus = 'undelivered';
      
      // Increment status_change_count only if status changed
      const statusChanged = oldStatus !== newStatus;
      const currentCount = Number((order as any).status_change_count) || 1;
      const newCount = statusChanged ? currentCount + 1 : currentCount;
      
      const updatePayload: any = {
        deliveryStatus: newStatus,
        unable_to_deliver_reason: unableToDeliverReason,
      };
      
      // Only update status_change_count if status changed
      if (statusChanged) {
        updatePayload.status_change_count = newCount;
      }
      
      const { error } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      if (error) {
        console.error("status update error", error);
        toast.error("Failed to update status");
        return;
      }
      
      // Send notification if status changed
      if (oldStatus !== 'undelivered') {
        await sendStatusChangeNotification({ ...order, deliveryStatus: 'undelivered' }, 'undelivered');
      }
      
      // optionally insert into status history table if exists (silently fail if table doesn't exist)
      try {
        await supabase.from("order_status_history").insert({ order_id: order.id, status: 'undelivered' });
      } catch (err) {
        // Table doesn't exist, that's okay
        console.log("order_status_history table not available");
      }
      // refresh
      await fetchOrderDetails();
      setIsUnableToDeliverDialogOpen(false);
      setOpenUpdateStatus(false);
      toast.success("Status updated to Undelivered");
    } catch (err) {
      console.error("handleSaveUnableToDeliver error", err);
      toast.error("Failed to update status");
    }
  }

  // assign driver (update orders.driver_id + deliveryStatus, then email customer)
  async function handleDriverAssignment() {
    if (!order || !selectedDriverId) return;
    try {
      const previousStatus = (order.deliveryStatus || order.status || "").toLowerCase().trim();
      const statusChanged = previousStatus !== "driver assigned";
      const currentCount = Number((order as any).status_change_count) || 1;
      const newCount = statusChanged ? currentCount + 1 : currentCount;

      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: Number(selectedDriverId),
          deliveryStatus: "driver assigned",
          status_change_count: newCount,
        })
        .eq("id", order.id);
      if (error) {
        console.error("assign driver update error", error);
        toast.error("Failed to assign driver");
        return;
      }
      // optional: update drivers table status to 'Assigned'
      await supabase.from("drivers").update({ status: "Assigned" }).eq("id", Number(selectedDriverId));

      // Send email to customer (same as OrderForm when driver assigned)
      if (customer?.email) {
        try {
          await supabase.functions.invoke("send_order_email", {
            body: JSON.stringify({
              to: customer.email,
              customer_name: customer.company_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Customer",
              order_name: order.order_name || `#${order.id}`,
              order_id: order.order_name || String(order.id),
              delivery_status: "driver assigned",
              quantity: (order as any).quantity ?? 1,
              previous_status: previousStatus || null,
              email_type: "status_updated",
            }),
          });
        } catch (emailErr: any) {
          console.error("Error sending driver-assigned email:", emailErr);
          // Don't block success toast
        }
      }

      // refresh lists
      await fetchOrderDetails();
      await fetchDrivers(driversPage);
      setIsDriverDialogOpen(false);
      setSelectedDriverId("");
      toast.success("Driver assigned");
    } catch (err) {
      console.error("handleDriverAssignment error", err);
      toast.error("Failed to assign driver");
    }
  }

  // file change handler for invoice
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be < 10MB");
      return;
    }
    setInvoiceFile(file);
    toast.success("Invoice file selected");
  };

  // initial fetch
  useEffect(() => {
    fetchOrderDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // fetch drivers when dialog open or page changes
  useEffect(() => {
    if (isDriverDialogOpen) fetchDrivers(driversPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriverDialogOpen, driversPage]);

  // simple helper to format money
  const fmtMoney = (n: number | null | undefined) => `$${((n || 0)).toFixed(2)}`;

  // UI: if loading show skeleton minimal (kept minimal to avoid changing design)
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-6 bg-slate-200 rounded w-1/4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-40 bg-slate-200 rounded" />
              <div className="h-64 bg-slate-200 rounded" />
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 rounded" />
              <div className="h-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-600">Order not found.</div>
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={onBack}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-3xl mb-1">Order Details</h1>
            <p className="text-slate-600">{order.order_name || `#${order.id}`}</p>
          </div>
        </div>

        <Badge className={`px-4 py-2 text-sm ${getStatusColor(order.deliveryStatus || order.status || "Processing")}`}>
          {formatStatusText(order.deliveryStatus || order.status || "pending")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-sky-600" /> Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
          

              <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Company Name</div>
                  <div className="font-medium">{customer?.company_name || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Contact Person</div>
                  <div className="font-medium">{(customer?.first_name || "") + (customer?.last_name ? ` ${customer?.last_name}` : "") || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Franchise</div>
                  <div className="font-medium">
                    {franchise?.franchise_name || "Super Admin"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</div>
                  {customer?.email ? (
                    <a href={`mailto:${customer.email}`} className="font-medium text-sky-600 hover:underline">
                      {customer.email}
                    </a>
                  ) : (
                    <div className="font-medium text-sky-600">-</div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</div>
                  {customer?.phone ? (
                    <a href={`tel:${customer.phone}`} className="font-medium text-sky-600 hover:underline">
                      {customer.phone}
                    </a>
                  ) : (
                    <div className="font-medium">-</div>
                  )}
                </div>
                </div>

                {order && (order.special_event_logo || order.logo) && (
                <div className="mb-4">
                  <div className="text-sm text-slate-500 mb-2">Order Logo</div>
                  <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-50">
                    <img src={order.special_event_logo || order.logo || ''} alt={`${order.order_name || 'Order'} logo`} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              </div>

              <Separator />

              <div>
                <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Delivery Address</div>
                <div className="font-medium">
                  {(() => {
                    const addr = customer?.delivery_address;
                    if (!addr) return '-';
                    
                    // Handle string address
                    if (typeof addr === 'string') {
                      // Check if it's a JSON string that needs parsing
                      try {
                        const parsed = JSON.parse(addr);
                        if (Array.isArray(parsed)) {
                          // Find selected address or use first one
                          const selectedAddr = parsed.find((a: any) => a.isSelected === true) || parsed[0];
                          if (selectedAddr) {
                            const parts = [
                              selectedAddr.street,
                              selectedAddr.city,
                              selectedAddr.state,
                              selectedAddr.zipCode
                            ].filter(Boolean);
                            return parts.join(', ') || selectedAddr.label || 'Address';
                          }
                          return addr;
                        }
                        // Single object
                        if (parsed.street || parsed.address || parsed.formatted_address) {
                          return parsed.address || parsed.formatted_address || 
                            [parsed.street, parsed.city, parsed.state, parsed.zipCode].filter(Boolean).join(', ');
                        }
                      } catch {
                        // Not JSON, return as is
                        return addr;
                      }
                      return addr;
                    }
                    
                    // Handle array of addresses
                    if (Array.isArray(addr)) {
                      const selectedAddr = addr.find((a: any) => a.isSelected === true) || addr[0];
                      if (selectedAddr) {
                        const parts = [
                          selectedAddr.street,
                          selectedAddr.city,
                          selectedAddr.state,
                          selectedAddr.zipCode
                        ].filter(Boolean);
                        return parts.join(', ') || selectedAddr.label || 'Address';
                      }
                      return 'Address not available';
                    }
                    
                    // Handle single object
                    if (typeof addr === 'object' && addr !== null) {
                      const addrObj = addr as Record<string, any>;
                      
                      // Check for formatted_address or address key
                      if (addrObj?.address && typeof addrObj.address === 'string') return addrObj.address;
                      if (addrObj?.formatted_address && typeof addrObj.formatted_address === 'string') return addrObj.formatted_address;
                      
                      // Try to format from address components
                      if (addrObj.street || addrObj.city || addrObj.state) {
                        const parts = [
                          addrObj.street,
                          addrObj.city,
                          addrObj.state,
                          addrObj.zipCode
                        ].filter(Boolean);
                        if (parts.length > 0) return parts.join(', ');
                      }
                      
                      // Fallback: try to stringify
                      try {
                        return JSON.stringify(addr);
                      } catch {
                        return String(addr);
                      }
                    }
                    
                    return String(addr);
                  })()}
                </div>
                {customer?.delivery_zone && <div className="text-sm text-slate-500 mt-1">Zone: {customer.delivery_zone}</div>}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-sky-600" /> Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-lg">Cases</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Quantity: {(order as any)?.quantity || 0} cases
                  </div>
                </div> 
              </div>
            </CardContent>
          </Card>

          {/* Delivery Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-sky-600" /> Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Driver</div>
                  <div className="font-medium">{order.driver_id ? (() => {
                    const drv = drivers.find(d => d.id === order.driver_id);
                    return drv ? drv.driver_name : `Driver #${order.driver_id}`;
                  })() : "-"}</div>
                </div>
                {order.driver_id && (() => {
                  const drv = drivers.find(d => d.id === order.driver_id);
                  if (!drv) return null;
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      {drv.email && (
                        <div>
                          <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Email
                          </div>
                          <a href={`mailto:${drv.email}`} className="font-medium text-[#00a1ff] hover:underline">
                            {drv.email}
                          </a>
                        </div>
                      )}
                      {drv.phone_number && (
                        <div>
                          <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Phone
                          </div>
                          <a href={`tel:${drv.phone_number}`} className="font-medium text-[#00a1ff] hover:underline">
                            {drv.phone_number}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Unable to Deliver Reason Section */}
          {order.deliveryStatus?.toLowerCase() === 'unable to deliver' && (order as any).unable_to_deliver_reason && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <X className="w-5 h-5 text-red-500" />
                  Unable to Deliver Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{(order as any).unable_to_deliver_reason}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */} 
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  Order Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-sm">{order.notes}</p>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-sky-600" /> Order Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Order Date</div>
                <div className="font-medium">{order.order_date ? new Date(order.order_date).toLocaleDateString() :  "-"}</div>
              </div> 
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-sky-600" /> Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusHistory.map((h, idx) => (
                  <div key={idx} className="relative pl-6">
                    {idx !== statusHistory.length - 1 && <div className="absolute left-2 top-6 bottom-0 w-px bg-slate-200" />}
                    <div className="absolute left-0 top-1"><CheckCircle className="w-4 h-4 text-green-600" /></div>
                    <div>
                      <div className="font-medium text-sm">{h.deliveryStatus || h.status}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {h.timestamp || h.created_at 
                          ? new Date(h.timestamp || h.created_at).toLocaleDateString()
                          : ''
                        }
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{h.description || ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => { setIsDriverDialogOpen(true); }}>
                <UserPlus className="w-4 h-4 mr-2" /> Assign/Reassign Driver
              </Button>

              {/* <Button className="w-full gradient-primary text-white hover:opacity-90" onClick={() => setIsInvoiceDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Upload and Send Invoice
              </Button>

              <Button className="w-full" variant="outline" onClick={() => { 
                if (customer?.email) window.location.href = `mailto:${customer.email}`;
              }}>
                <Mail className="w-4 h-4 mr-2" /> Email Customer
              </Button> */}

              <Button className="w-full" variant="secondary" onClick={() => setOpenUpdateStatus(true)}>
                <Package className="w-4 h-4 mr-2" /> Update Status
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Update Status Dialog */}
      <Dialog open={openUpdateStatus} onOpenChange={setOpenUpdateStatus}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Label htmlFor="status">Delivery Status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select a status" />
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenUpdateStatus(false)}>Cancel</Button>
            <Button type="button" onClick={handleStatusUpdate}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Driver to Order</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <Label>Available Drivers</Label>
              <div className="space-y-2">
                {drivers.length === 0 && <div className="p-4 text-center text-slate-500">No drivers</div>}
                {drivers.map((driver) => {
                  const driverStatus = (driver.status || "").toLowerCase();
                  
                  return (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedDriverId === driver.id
                          ? "border-sky-500 bg-sky-50 cursor-pointer"
                          : "border-slate-200 hover:border-slate-300 bg-white cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{driver.driver_name}</span>
                            <Badge className={`text-xs ${driverStatus === "available" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}`}>{driver.status}</Badge>
                          </div>
                          <div className="text-sm text-slate-600">{driver.phone_number}</div>
                        </div>
                        {selectedDriverId === driver.id && <Check className="w-5 h-5 text-sky-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-slate-600">Showing page {driversPage} of {Math.ceil((driversTotal || 0) / driversPageSize) || 1}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDriversPage((p) => Math.max(1, p - 1))} disabled={driversPage === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setDriversPage((p) => (p * driversPageSize < (driversTotal || 0) ? p + 1 : p))} disabled={driversPage * driversPageSize >= (driversTotal || 0)}>Next</Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsDriverDialogOpen(false); setSelectedDriverId(""); }}>Cancel</Button>
            <Button type="button" onClick={handleDriverAssignment} disabled={!selectedDriverId}>Assign Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-sky-600" /> Upload and Send Invoice</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm text-blue-900">{customer?.company_name || "Customer"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-email" className="flex items-center gap-2"><Mail className="w-4 h-4 text-sky-600" /> Send Invoice To</Label>
              <Input id="invoice-email" type="email" placeholder="customer@example.com" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} className="w-full" />
              <p className="text-xs text-slate-500">Default: {customer?.email || "—"}</p>
            </div>

            <div className="space-y-2">
              <Label>Invoice File (PDF only, max 10MB)</Label>
              {!invoiceFile ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-500">PDF files only (MAX. 10MB)</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg"><FileText className="w-5 h-5 text-green-600" /></div>
                    <div>
                      <p className="font-medium text-sm text-green-900">{invoiceFile.name}</p>
                      <p className="text-xs text-green-600">{(invoiceFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setInvoiceFile(null)} className="hover:bg-red-100 hover:text-red-600"><X className="w-4 h-4" /></Button>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="text-amber-700 mt-0.5">⚠️</div>
                <div className="text-xs text-amber-800">
                  <p className="font-medium mb-1">Before sending:</p>
                  <ul className="space-y-0.5 text-amber-700">
                    <li>• Verify the invoice details are correct</li>
                    <li>• Ensure the PDF is properly formatted</li>
                    <li>• The invoice will be sent immediately to the customer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsInvoiceDialogOpen(false); setInvoiceFile(null); setInvoiceEmail(customer?.email || ""); }}>Cancel</Button>
            <Button type="button" className="gradient-primary text-white" onClick={handleSendInvoice} disabled={!invoiceFile}><Send className="w-4 h-4 mr-2" /> Send Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                setUnableToDeliverReason((order as any)?.unable_to_deliver_reason || '');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUnableToDeliver}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
