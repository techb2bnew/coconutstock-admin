"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, PhoneCallIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  ArrowLeft,
  Mail,
  Upload,
  FileText,
  StickyNote,
  Calendar,
  Package,
  Download,
  User,
  MapPin,
  Phone,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { log } from "console";
import Autocomplete from "react-google-autocomplete";
import { usePathname, useRouter } from "next/navigation";

interface Customer {
  id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  Customer_title: string;
  delivery_address: string;
  companyLogo?: string;
  delivery_zone?: string | number;
  delivery_zone_id?: string | number; // Store original ID for editing
  zoneCity?: string;
  alternateEmail1?: string;
  alternateEmail2?: string;
  alternatePhone?: string;
  status?: string;
  total_orders?: number;
  last_order?: string;
  registration_date?: string;
  created_at?: string;
  notes?: string;
  documents?: any;
  resale_certificate?: any;
  other_documents?: any;
  account_status?: boolean;
}

interface DeliveryZone {
  id: string;
  zone_name: string;
  description: string | null;
  status: string;
}

// Address Autocomplete Component
interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function AddressAutocomplete({
  value,
  onChange,
  className,
  placeholder,
}: AddressAutocompleteProps) {
  return (
    <Autocomplete
      apiKey="AIzaSyBEQp-ZFMYZjsTNyximu2pAifQ9EWA4W3M"
      onPlaceSelected={(place: any) => {
        const address = place.formatted_address || place.name || "";
        onChange(address);
      }}
      options={{
        types: ["address"],
        componentRestrictions: { country: "us" }, // You can change this to your country
      }}
      defaultValue={value}
      className={className}
      placeholder={placeholder}
      style={{
        width: "100%",
        height: "2.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        borderRadius: "0.375rem",
        border: "1px solid #d1d5db",
        backgroundColor: "#f9fafb",
      }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      }}
    />
  );
}

interface Company {
  id: string;
  company_name: string;
  email: string;
  phone_number: string;
  address: string;
  franchise_id?: string | null;
  companyLogo?: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [zoneMap, setZoneMap] = useState<Map<string, string>>(new Map());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyHasMore, setCompanyHasMore] = useState(true);
  const companyItemsPerPage = 20;
  const [open, setOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [pricingCustomer, setPricingCustomer] = useState<Customer | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewPageOpen, setViewPageOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [customPricing, setCustomPricing] = useState({
    enabled: false,
    case: "",
    unit: "",
  });
  const [franchiseId, setFranchiseId] = useState<string | null | undefined>(
    undefined,
  );

  const [form, setForm] = useState<any>({
    company: "",
    firstName: "",
    lastName: "",
    email: "",
    Customer_title: "",
    phone: "",
    address: "",
    deliveryZone: "",
    deliveryZoneName: "",
    customPriceUnit: "",
    companyLogo: "",
    customPriceCase: "",
    alternateEmail1: "",
    alternateEmail2: "",
    alternatePhone: "",
    zoneCity: "",
    notes: "",
    companyId: "",
    companyFranchiseId: null,
    account_status: null,
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Helper function to convert delivery_address to string (for search, etc.)
  const getAddressString = (addr: any): string => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      if ((addr as any).address && typeof (addr as any).address === "string")
        return (addr as any).address;
      if (
        (addr as any).formatted_address &&
        typeof (addr as any).formatted_address === "string"
      )
        return (addr as any).formatted_address;
      try {
        return JSON.stringify(addr);
      } catch {
        return String(addr);
      }
    }
    return String(addr);
  };

  // Helper: get clean single-line address string for form input
  const getPrimaryAddressForForm = (deliveryAddress: any): string => {
    if (!deliveryAddress) return "";

    let parsed: any = deliveryAddress;

    // If it's a JSON string, try to parse
    if (typeof deliveryAddress === "string") {
      try {
        const json = JSON.parse(deliveryAddress);
        parsed = json;
      } catch {
        // Not JSON, just return as-is (already a string address)
        return deliveryAddress;
      }
    }

    // If it's an array of addresses (like in DB screenshot)
    if (Array.isArray(parsed)) {
      const arr = parsed as any[];
      const selected = arr.find((a) => a && a.isSelected) || arr[0];
      if (selected && typeof selected === "object") {
        const street = (selected as any).street;
        const city = (selected as any).city;
        const state = (selected as any).state;
        const zip = (selected as any).zipCode || (selected as any).zip;
        const label = (selected as any).label;

        // Prefer street + city + state + zip; fallback to label
        const parts = [street, city, state, zip].filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
        if (label) return String(label);
      }
    }

    // If it's a single object with fields
    if (typeof parsed === "object" && parsed !== null) {
      const street = (parsed as any).street;
      const city = (parsed as any).city;
      const state = (parsed as any).state;
      const zip = (parsed as any).zipCode || (parsed as any).zip;
      const label = (parsed as any).label;

      const parts = [street, city, state, zip].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
      if (label) return String(label);
    }

    // Fallback to generic string conversion
    return getAddressString(parsed);
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter((cust) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const addressStr = getAddressString(cust.delivery_address);
    return (
      cust.company_name?.toLowerCase().includes(search) ||
      cust.first_name?.toLowerCase().includes(search) ||
      cust.last_name?.toLowerCase().includes(search) ||
      cust.email?.toLowerCase().includes(search) ||
      cust.phone?.toLowerCase().includes(search) ||
      addressStr.toLowerCase().includes(search)
    );
  });

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "company":
        aValue = a.company_name || "";
        bValue = b.company_name || "";
        break;
      case "contact":
        aValue = `${a.first_name || ""} ${a.last_name || ""}`.trim();
        bValue = `${b.first_name || ""} ${b.last_name || ""}`.trim();
        break;
      case "email":
        aValue = a.email || "";
        bValue = b.email || "";
        break;
      case "phone":
        aValue = a.phone || "";
        bValue = b.phone || "";
        break;
      case "zone":
        aValue = a.delivery_zone || "";
        bValue = b.delivery_zone || "";
        break;
      case "total_orders":
        aValue = a.total_orders ?? 0;
        bValue = b.total_orders ?? 0;
        break;
      case "last_order":
        aValue = a.last_order === "—" ? "" : a.last_order || "";
        bValue = b.last_order === "—" ? "" : b.last_order || "";
        break;
      case "status":
        aValue = a.status || "";
        bValue = b.status || "";
        break;
      default:
        return 0;
    }

    // Handle string comparison
    if (typeof aValue === "string" && typeof bValue === "string") {
      const comparison = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? comparison : -comparison;
    }

    // Handle number comparison
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = sortedCustomers.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  console.log("currentCustomers", currentCustomers);

  const updateForm = (key: string, value: any) => {
    setForm((p: any) => ({ ...p, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  useEffect(() => {
    const resolveFranchise = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) {
          setFranchiseId(null);
          return;
        }

        const { data: franchise, error } = await supabase
          .from("franchises")
          .select("id")
          .eq("owner_email", email)
          .maybeSingle();

        if (error) {
          console.error("Franchise lookup error (customers page):", error);
          setFranchiseId(null);
          return;
        }

        const id = franchise?.id ?? null;
        setFranchiseId(id);

        // Don't modify localStorage here - AdminLayout handles it
        // Only set it if we found a franchise (don't remove if not found)
        if (typeof window !== "undefined" && id) {
          localStorage.setItem("current_franchise_id", id);
        }
      } catch (err) {
        console.error("Franchise resolve error (customers page):", err);
        setFranchiseId(null);
      }
    };

    void resolveFranchise();
  }, []);

  useEffect(() => {
    if (franchiseId === undefined) return;
    fetchData();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchiseId]);

  // Fetch companies with pagination
  const fetchCompanies = async (
    page: number = 1,
    search: string = "",
    append: boolean = false,
  ) => {
    setCompanyLoading(true);
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      const isSuperAdmin =
        typeof window !== "undefined"
          ? localStorage.getItem("is_super_admin") === "true"
          : false;
      const currentFranchiseId =
        typeof window !== "undefined"
          ? localStorage.getItem("current_franchise_id")
          : null;

      let companyQuery = supabase
        .from("company")
        .select(
          "id, company_name, email, phone_number, address, franchise_id, companyLogo, delivery_zone, delivery_zone_name",
          { count: "exact" },
        )
        .order("company_name", { ascending: true })
        .range(
          (page - 1) * companyItemsPerPage,
          page * companyItemsPerPage - 1,
        );

      // Filter based on user role:
      // Super Admin: Show ALL companies (no filter)
      // Franchise: Show only companies where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees ALL companies (no filter applied)
        // Don't apply any filter - show all data
      } else if (currentFranchiseId) {
        // Franchise sees only their own companies
        companyQuery = companyQuery.eq("franchise_id", currentFranchiseId);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        companyQuery = companyQuery.eq("id", "-1"); // Impossible condition
      }

      if (search.trim()) {
        companyQuery = companyQuery.ilike("company_name", `%${search}%`);
      }

      const { data: companiesData, error: err, count } = await companyQuery;

      if (err) {
        console.error("Company fetch error:", err);
        toast.error("Failed to fetch companies");
      } else {
        if (append) {
          setCompanies((prev) => [...prev, ...(companiesData || [])]);
        } else {
          setCompanies(companiesData || []);
        }
        setCompanyHasMore(
          (companiesData?.length || 0) === companyItemsPerPage &&
            (count || 0) > page * companyItemsPerPage,
        );
      }
    } catch (error) {
      console.error("Fetch companies error:", error);
      toast.error("Failed to fetch companies");
    } finally {
      setCompanyLoading(false);
    }
  };

  // Load more companies on scroll
  const handleCompanyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (bottom && !companyLoading && companyHasMore) {
      const nextPage = companyPage + 1;
      setCompanyPage(nextPage);
      fetchCompanies(nextPage, companySearchTerm, true);
    }
  };

  // Handle company search
  useEffect(() => {
    if (companySearchOpen) {
      setCompanyPage(1);
      fetchCompanies(1, companySearchTerm, false);
    }
  }, [companySearchTerm]);

  // Reset companies when popover opens
  useEffect(() => {
    if (companySearchOpen) {
      setCompanyPage(1);
      setCompanySearchTerm("");
      fetchCompanies(1, "", false);
    }
  }, [companySearchOpen]);

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Load Google Maps script for autocomplete
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn(
        "Google Maps API key not found. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file",
      );
      return;
    }

    // Check if script is already loaded
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
      const existingScript = document.querySelector(
        `script[src*="maps.googleapis.com"]`,
      );
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  const fetchData = async () => {
    // Always read from localStorage (source of truth set by AdminLayout)
    // Don't rely on state as it might be stale after create
    const isSuperAdmin =
      typeof window !== "undefined"
        ? localStorage.getItem("is_super_admin") === "true"
        : false;
    const currentFranchiseId =
      typeof window !== "undefined"
        ? localStorage.getItem("current_franchise_id")
        : null;
    const currentStaffEmail =
      typeof window !== "undefined"
        ? localStorage.getItem("current_staff_email")
        : null;

    let customerQuery = supabase.from("customers").select("*");

    // Filter based on user role:
    // Super Admin: Show ALL customers (no filter)
    // Franchise: Show only customers where franchise_id = their franchise_id
    if (isSuperAdmin) {
      // Super admin sees ALL customers (no filter applied)
      // Don't apply any filter - show all data
    } else if (currentFranchiseId) {
      // Franchise sees only their own data
      customerQuery = customerQuery.eq("franchise_id", currentFranchiseId);
    } else if (currentStaffEmail) {
      // Staff member (not franchise owner): filter by creator
      customerQuery = customerQuery.eq("created_by_email", currentStaffEmail);
    } else {
      // If no franchise_id found, show empty (shouldn't happen but safety check)
      customerQuery = customerQuery.eq("id", "-1"); // Impossible condition
    }

    // Order by created_at descending so newest customers appear first
    customerQuery = customerQuery.order("created_at", { ascending: false });

    const { data: customersData, error: custErr } = await customerQuery;
    if (custErr) return console.error("Customer fetch error:", custErr);

    // Fetch delivery zones from delivery_zones table (filtered by franchise_id)
    let zonesQuery = supabase
      .from("delivery_zones")
      .select("id, zone_name, description, status")
      .eq("status", "Active");

    // Filter by franchise_id if available, otherwise show all zones (HQ admin sees all)
    if (currentFranchiseId) {
      zonesQuery = zonesQuery.eq("franchise_id", currentFranchiseId);
    }
    // If no franchise_id, don't filter - HQ admin sees all zones

    const { data: zonesData, error: zonesErr } = await zonesQuery.order(
      "zone_name",
      { ascending: true },
    );

    if (zonesErr) console.error("Delivery zones fetch error:", zonesErr);

    const newZoneMap = new Map<string, string>();
    zonesData?.forEach((z) => newZoneMap.set(String(z.id), z.zone_name || "—"));
    setDeliveryZones(zonesData || []);
    setZoneMap(newZoneMap);

    const customersWithOrders = await Promise.all(
      (customersData || []).map(async (cust) => {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_date")
          .eq("customer_id", cust.id)
          .order("order_date", { ascending: false });

        const zoneName = newZoneMap.get(String(cust.delivery_zone)) || "—";

        return {
          ...cust,
          delivery_zone: zoneName, // Display name
          delivery_zone_id: cust.delivery_zone, // Original ID for editing
          total_orders: orders?.length || 0,
          last_order: orders?.[0]?.order_date || "—",
        };
      }),
    );

    setCustomers(customersWithOrders);
  };

  const resetForm = () => {
    setForm({
      company: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      deliveryZone: "",
      deliveryZoneName: "",
      customPriceUnit: "",
      companyLogo: "",
      customPriceCase: "",
      alternateEmail1: "",
      alternateEmail2: "",
      alternatePhone: "",
      zoneCity: "",
      notes: "",
      companyId: "",
      companyFranchiseId: null,
      account_status: false,
    });
    setLogoPreview(null);
    setEditCustomer(null);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.company.trim()) newErrors.company = "Company name is required";
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!form.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      // Remove any non-digit characters for validation
      const digitsOnly = form.phone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        newErrors.phone = "Phone number must be exactly 10 digits";
      }
    }
    if (!form.address.trim()) newErrors.address = "Address is required";

    // Validate alternate emails if provided
    if (form.alternateEmail1 && form.alternateEmail1.trim()) {
      const altEmail1 = form.alternateEmail1.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(altEmail1)) {
        newErrors.alternateEmail1 = "Invalid email format";
      } else if (altEmail1 === form.email?.toLowerCase().trim()) {
        newErrors.alternateEmail1 = "Cannot be same as primary email";
      } else if (altEmail1 === form.alternateEmail2?.toLowerCase().trim()) {
        newErrors.alternateEmail1 = "Cannot be same as alternate email 2";
      }
    }
    if (form.alternateEmail2 && form.alternateEmail2.trim()) {
      const altEmail2 = form.alternateEmail2.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(altEmail2)) {
        newErrors.alternateEmail2 = "Invalid email format";
      } else if (altEmail2 === form.email?.toLowerCase().trim()) {
        newErrors.alternateEmail2 = "Cannot be same as primary email";
      } else if (altEmail2 === form.alternateEmail1?.toLowerCase().trim()) {
        newErrors.alternateEmail2 = "Cannot be same as alternate email 1";
      }
    }

    // Validate alternate phone if provided
    if (form.alternatePhone && form.alternatePhone.trim()) {
      const digitsOnly = form.alternatePhone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        newErrors.alternatePhone = "Phone number must be exactly 10 digits";
      } else if (digitsOnly === form.phone.replace(/\D/g, "")) {
        newErrors.alternatePhone = "Cannot be same as primary phone";
      }
    }
    if (!form.Customer_title?.trim())
      newErrors.Customer_title = "Customer title is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Generate temporary password
  const generateTemporaryPassword = () => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Helper function to check if email exists in any table
  const checkEmailExists = async (
    email: string,
    excludeId?: string,
  ): Promise<{ exists: boolean; message: string }> => {
    const emailLower = email.toLowerCase().trim();

    // Check customers table
    const { data: customerData } = await supabase
      .from("customers")
      .select("id, email")
      .eq("email", emailLower)
      .maybeSingle();

    if (customerData && (!excludeId || customerData.id !== excludeId)) {
      return {
        exists: true,
        message: "This email is already registered as a customer.",
      };
    }

    // Check company table
    const { data: companyData } = await supabase
      .from("company")
      .select("id, email")
      .eq("email", emailLower)
      .maybeSingle();

    if (companyData && (!excludeId || companyData.id !== excludeId)) {
      return {
        exists: true,
        message: "This email is already registered as a company.",
      };
    }

    // Check drivers table
    const { data: driverData } = await supabase
      .from("drivers")
      .select("id, email")
      .eq("email", emailLower)
      .maybeSingle();

    if (driverData && (!excludeId || driverData.id !== excludeId)) {
      return {
        exists: true,
        message: "This email is already registered as a driver.",
      };
    }

    // Check franchises table
    const { data: franchiseData } = await supabase
      .from("franchises")
      .select("id, owner_email")
      .eq("owner_email", emailLower)
      .maybeSingle();

    if (franchiseData && (!excludeId || franchiseData.id !== excludeId)) {
      return {
        exists: true,
        message: "This email is already registered as a franchise owner.",
      };
    }

    // Check staff table
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, email")
      .eq("email", emailLower)
      .maybeSingle();

    if (staffData && (!excludeId || staffData.id !== excludeId)) {
      return {
        exists: true,
        message: "This email is already registered as staff.",
      };
    }

    return { exists: false, message: "" };
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // Check if email already exists (only for new customers)
    if (!editCustomer) {
      const emailCheck = await checkEmailExists(form.email);
      if (emailCheck.exists) {
        toast.error(emailCheck.message);
        return;
      }
    } else {
      // For edit, check if email exists in other records
      const emailCheck = await checkEmailExists(form.email, editCustomer.id);
      if (emailCheck.exists) {
        toast.error(emailCheck.message);
        return;
      }
    }
    const normalizeUuidOrNull = (v: any) => {
      const s = String(v ?? "").trim();
      if (!s || s === "—") return null;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      return uuidRegex.test(s) ? s : null;
    };

    const normalizeTextOrNull = (v: any) => {
      const s = String(v ?? "").trim();
      if (!s || s === "—") return null;
      return s;
    };

    setLoading(true);

    const tempPassword: string = generateTemporaryPassword();

    // Always read from localStorage (source of truth set by AdminLayout)
    const isSuperAdmin =
      typeof window !== "undefined"
        ? localStorage.getItem("is_super_admin") === "true"
        : false;
    const currentFranchiseId =
      typeof window !== "undefined"
        ? localStorage.getItem("current_franchise_id")
        : null;
    const currentStaffEmail =
      typeof window !== "undefined"
        ? localStorage.getItem("current_staff_email")
        : null;

    // Use the selected company's franchise_id if available, otherwise fall back to current logic
    // If company has franchise_id, use it; otherwise use Super Admin logic (null) or current franchise
    let customerFranchiseId: string | null = null;
    if (form.companyFranchiseId) {
      // Company has a franchise_id, use it
      customerFranchiseId = form.companyFranchiseId;
    } else if (isSuperAdmin) {
      // Super Admin: no franchise_id
      customerFranchiseId = null;
    } else {
      // Franchise user: use their franchise_id
      customerFranchiseId = currentFranchiseId || null;
    }

    const data = {
      company_name: form.company,
      first_name: form.firstName,
      last_name: form.lastName,
      Customer_title: form.Customer_title,
      email: form.email,
      phone: form.phone,
      delivery_address: form.address,
      // delivery_zone: form.deliveryZone,
      // delivery_zone_name: form.deliveryZoneName || null,
      delivery_zone: normalizeUuidOrNull(form.deliveryZone),
      delivery_zone_name: normalizeTextOrNull(form.deliveryZoneName),

      zoneCity: form.zoneCity || null,
      created_by_email: isSuperAdmin ? null : currentStaffEmail || null,
      alternateEmail1: form.alternateEmail1 || null,
      alternateEmail2: form.alternateEmail2 || null,
      alternatePhone: form.alternatePhone || null,
      company_id: form.companyId || null, // Save company_id instead of companyLogo
      notes: form.notes || null,
      password: tempPassword,
      status: "active",
      franchise_id: customerFranchiseId,
      account_status: form.account_status,
    };

    let error;
    if (editCustomer) {
      const { error: updateError } = await supabase
        .from("customers")
        .update(data)
        .eq("id", editCustomer.id);
      error = updateError;
    } else {
      // Save current session tokens to restore after signUp
      const { data: currentSession } = await supabase.auth.getSession();
      const savedAccessToken = currentSession?.session?.access_token;
      const savedRefreshToken = currentSession?.session?.refresh_token;

      // First, insert into customers table (tempPassword already generated above)
      const { error: insertError } = await supabase
        .from("customers")
        .insert(data);

      if (insertError) {
        error = insertError;
      } else {
        // Try to create auth account (non-blocking, customer record already created)
        const loginUrl = `${window.location.origin}/login`;

        // Create auth account - restore session immediately after
        try {
          const { data: authData, error: authError } =
            await supabase.auth.signUp({
              email: form.email,
              password: tempPassword,
              options: {
                emailRedirectTo: loginUrl,
                data: {
                  name: `${form.firstName} ${form.lastName}`,
                  role: "Customer",
                  is_temporary_password: true,
                },
              },
            });

          if (authError) {
            setLoading(false);
            console.log(
              "Auth account creation skipped (may already exist or failed):",
              authError.message,
            );
          } else if (authData.user) {
            console.log("Customer auth account created successfully");
          }
        } catch (authErr) {
          setLoading(false);
          console.error("Auth creation error:", authErr);
        }

        // CRITICAL: Immediately restore the admin's session
        if (savedAccessToken && savedRefreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: savedAccessToken,
              refresh_token: savedRefreshToken,
            });
            console.log("Admin session restored successfully");
          } catch (restoreErr) {
            console.error("Session restore error:", restoreErr);
            // If restore fails, try to get session again
            const { data: newSession } = await supabase.auth.getSession();
            if (!newSession?.session && savedAccessToken && savedRefreshToken) {
              // Last attempt to restore
              await supabase.auth.setSession({
                access_token: savedAccessToken,
                refresh_token: savedRefreshToken,
              });
            }
          }
        }

        // Send welcome email (non-blocking)
        let franchiseName: string | null = null;
        if (form.companyFranchiseId) {
          const { data: f } = await supabase
            .from("franchises")
            .select("franchise_name")
            .eq("id", form.companyFranchiseId)
            .maybeSingle();
          franchiseName = f?.franchise_name || null;
        }
        supabase.functions
          .invoke("clever-handler", {
            body: {
              to: form.email,
              name: `${form.firstName} ${form.lastName}`,
              email: form.email,
              password: tempPassword,
              role: "Customer",
              loginUrl: loginUrl,
              companyName: form.company,
              franchiseName: franchiseName || null,
              deliveryZoneName: form.deliveryZoneName || null,
            },
          })
          .then(({ error: emailError }) => {
            if (emailError) {
              console.log(
                "Email function not available (this is okay):",
                emailError.message,
              );
            } else {
              console.log("Email sent successfully");
            }
          })
          .catch((err) => {
            console.log("Email function not configured (this is okay):", err);
          });
      }
    }

    if (!error) {
      setOpen(false);
      resetForm();
      setLoading(false);

      // Refresh the customer list from API
      await fetchData();
      toast.success(
        editCustomer
          ? "Customer updated successfully!"
          : "Customer created successfully!",
      );
    } else {
      console.error("Error saving customer:", error);

      // Check for duplicate email error
      if (error.code === "23505") {
        toast.error(
          "This email address is already registered. Please use a different email.",
        );
      } else {
        toast.error(
          editCustomer
            ? "Failed to update customer. Please try again."
            : "Failed to create customer. Please try again.",
        );
        setLoading(false);
      }
    }
  };

  const handleEdit = async (cust: Customer) => {
    setEditCustomer(cust);
    console.log(cust);

    // Fetch company's franchise_id if company name matches
    let companyFranchiseId: string | null = null;
    let companyId: string = "";
    if (cust.company_name) {
      try {
        const { data: companyData } = await supabase
          .from("company")
          .select("id, franchise_id")
          .eq("company_name", cust.company_name)
          .maybeSingle();

        if (companyData) {
          companyId = companyData.id;
          companyFranchiseId = companyData.franchise_id || null;
        }
      } catch (err) {
        console.error("Error fetching company franchise_id:", err);
      }
    }

    setForm({
      company: cust.company_name,
      firstName: cust.first_name,
      lastName: cust.last_name,
      Customer_title: cust.Customer_title,
      email: cust.email,
      phone: cust.phone,
      // delivery_address can be JSON array/object; convert to clean string for input
      address: getPrimaryAddressForForm(cust.delivery_address),
      deliveryZone: cust.delivery_zone_id || cust.delivery_zone || "", // Use original ID for editing
      deliveryZoneName: cust.delivery_zone || "", // Zone name for payload
      companyLogo: cust.companyLogo || "",
      alternateEmail1: cust.alternateEmail1 || "",
      alternateEmail2: cust.alternateEmail2 || "",
      alternatePhone: cust.alternatePhone || "",
      zoneCity: cust.zoneCity || "",
      notes: cust.notes || "",
      companyId: companyId,
      companyFranchiseId: companyFranchiseId,
      account_status: !!cust.account_status,
    });
    // Fetch company logo and delivery zone from company table using company_id
    if (companyId) {
      try {
        const { data: companyData } = await supabase
          .from("company")
          .select("companyLogo, delivery_zone, delivery_zone_name")
          .eq("id", companyId)
          .maybeSingle();

        if (companyData?.companyLogo) {
          setLogoPreview(companyData.companyLogo);
        } else {
          setLogoPreview(null);
        }
        if (
          companyData?.delivery_zone != null ||
          companyData?.delivery_zone_name
        ) {
          setForm((prev: any) => ({
            ...prev,
            deliveryZone:
              companyData.delivery_zone != null
                ? String(companyData.delivery_zone)
                : prev.deliveryZone,
            deliveryZoneName:
              companyData.delivery_zone_name || prev.deliveryZoneName,
          }));
        }
      } catch (err) {
        console.error("Error fetching company logo:", err);
        setLogoPreview(null);
      }
    } else {
      setLogoPreview(null);
    }
    setOpen(true);
  };

  const handleView = async (cust: Customer) => {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_date")
      .eq("customer_id", cust.id)
      .order("order_date", { ascending: false });

    const updatedCustomer = {
      ...cust,
      total_orders: orders?.length || 0,
      last_order: orders?.[0]?.order_date || "—",
    };

    setViewCustomer(updatedCustomer);
    setViewPageOpen(true);
  };

  const handleToggleStatus = async (customer: Customer) => {
    const newStatus = customer.status === "active" ? "inactive" : "active";

    try {
      const { error } = await supabase
        .from("customers")
        .update({ status: newStatus })
        .eq("id", customer.id);

      if (error) {
        console.error("Status update error:", error);
        return;
      }

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id ? { ...c, status: newStatus } : c,
        ),
      );

      // Note: If deactivating, you may want to disable login for this customer
      // This would require checking the auth.users table and updating user status
      // For now, the status in customers table controls access
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  const handleDeleteClick = (cust: Customer) => {
    setCustomerToDelete(cust);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    try {
      // Delete customer from database
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerToDelete.id);

      if (error) {
        console.error("Delete customer error:", error);

        // Check for specific foreign key constraint error
        if (error.code === "23503") {
          if (error.message.includes("driver_locations")) {
            toast.error(
              "Cannot delete customer. This customer has orders that are currently being tracked in driver locations. Please remove the orders from driver locations first, then you can delete the customer.",
            );
          } else {
            toast.error(
              "Cannot delete customer. This customer has related records that must be removed first.",
            );
          }
        } else {
          toast.error("Failed to delete customer. Please try again.");
        }
        return;
      }

      // Remove from local state
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));

      // Close dialog and reset
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      toast.success("Customer deleted successfully!");
    } catch (err: any) {
      console.error("Delete customer error:", err);

      // Handle foreign key constraint errors
      if (err?.code === "23503" || err?.message?.includes("driver_locations")) {
        toast.error(
          "Cannot delete customer. This customer has orders that are currently being tracked in driver locations. Please remove the orders from driver locations first, then you can delete the customer.",
        );
      } else {
        toast.error("Failed to delete customer. Please try again.");
      }
    }
  };

  const handleViewPricing = (cust: Customer) => {
    setPricingCustomer(cust);
    setCustomPricing({
      enabled: true,
      case: "",
      unit: "",
    });
    setPricingModalOpen(true);
  };

  const handleSavePricing = async () => {
    if (!pricingCustomer) return;

    const data = customPricing.enabled
      ? {
          custom_price_per_case: customPricing.case || null,
          custom_price_per_unit: customPricing.unit || null,
        }
      : {
          custom_price_per_case: null,
          custom_price_per_unit: null,
        };

    const { error } = await supabase
      .from("customers")
      .update(data)
      .eq("id", pricingCustomer.id);

    if (error) {
      console.error("Pricing update error:", error);
    } else {
      setPricingModalOpen(false);
      fetchData();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-800">
          Customer Management
        </h1>
        <p className="text-sm text-slate-500">CoconutStock HQ</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="relative w-1/3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search customers..."
              className="rounded-lg bg-white border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-200 pl-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
            />
          </div>
        </div>

        <Button
          onClick={() => {
            setEditCustomer(null);
            resetForm();
            setOpen(true);
          }}
          className="bg-[#00a1ff] hover:bg-[#0090e6]"
        >
          <Plus className="mr-2 h-4 w-4" /> Add New Customer
        </Button>

        {/* Full Page Modal */}
        {open && (
          <div className="fixed left-64 right-0 top-0 bottom-0 z-50 bg-gray-100 overflow-y-auto">
            <div className="min-h-screen bg-gray-100">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="  mx-auto px-6 py-4 flex items-center gap-4">
                  <button
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className="text-2xl font-semibold text-gray-900">
                    {editCustomer ? "Edit Customer" : "Add New Customer"}
                    <p className="text-sm text-gray-500 ml-auto">
                      CoconutStock HQ - Primary Store
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="  mx-auto px-6 py-8">
                <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
                  {/* Basic Information Section */}
                  <div>
                    {/* <div className="flex text-center justify-between">
                      <h2 className="text-md font-semibold text-gray-900 mb-4">
                        Basic Information
                      </h2>
                      <label className="flex items-center gap-2 text-md font-semibold text-gray-900 cursor-pointer select-none animate-bounce">
                        <input
                          type="checkbox"
                          className="h-6 w-6 accent-[#05dbfb]"
                          checked={!!form.account_status}
                          onChange={(e) =>
                            updateForm("account_status", e.target.checked)
                          }
                        />
                        Make it Normal Customer
                      </label>
                    </div> */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>
                          Company Name <span className="text-red-500">*</span>
                        </Label>
                        <Popover
                          open={companySearchOpen}
                          onOpenChange={setCompanySearchOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={companySearchOpen}
                              className={`w-full mt-1 h-10 bg-gray-50 border-gray-300 justify-between ${errors.company ? "border-red-500 focus:ring-red-500" : ""}`}
                            >
                              {form.company
                                ? companies.find(
                                    (c) => c.company_name === form.company,
                                  )?.company_name || form.company
                                : "Select company..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[400px] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput
                                placeholder="Search company..."
                                value={companySearchTerm}
                                onValueChange={setCompanySearchTerm}
                              />
                              <CommandList
                                className="max-h-[300px] overflow-y-auto"
                                onScroll={handleCompanyScroll}
                              >
                                <CommandEmpty>
                                  {companyLoading
                                    ? "Loading..."
                                    : "No company found."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {companies.map((company) => (
                                    <CommandItem
                                      key={company.id}
                                      value={company.company_name}
                                      onSelect={() => {
                                        updateForm(
                                          "company",
                                          company.company_name,
                                        );
                                        updateForm("companyId", company.id);
                                        updateForm(
                                          "companyFranchiseId",
                                          company.franchise_id || null,
                                        );
                                        // Set delivery zone from company (customer inherits company's zone)
                                        updateForm(
                                          "deliveryZone",
                                          (company as any).delivery_zone != null
                                            ? String(
                                                (company as any).delivery_zone,
                                              )
                                            : null,
                                        );
                                        updateForm(
                                          "deliveryZoneName",
                                          (company as any).delivery_zone_name
                                            ? String(
                                                (company as any)
                                                  .delivery_zone_name,
                                              )
                                            : null,
                                        );

                                        // Set company logo preview from company table (don't save to customer)
                                        if (company.companyLogo) {
                                          setLogoPreview(company.companyLogo);
                                        } else {
                                          setLogoPreview(null);
                                        }
                                        setCompanySearchOpen(false);
                                        setErrors((prev) => ({
                                          ...prev,
                                          company: "",
                                        }));
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        {company.companyLogo && (
                                          <img
                                            src={company.companyLogo}
                                            alt={company.company_name}
                                            className="w-8 h-8 rounded object-contain"
                                            onError={(e) => {
                                              (
                                                e.target as HTMLImageElement
                                              ).style.display = "none";
                                            }}
                                          />
                                        )}
                                        <div className="flex flex-col">
                                          <div className="font-medium">
                                            {company.company_name}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {company.email}
                                          </div>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {companyLoading && (
                                  <div className="p-2 text-center text-sm text-gray-500">
                                    Loading more...
                                  </div>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {errors.company && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.company}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>
                          {" "}
                          First Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="Enter first name"
                          className={`mt-1 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.firstName ? "border-red-500 focus:ring-red-500" : ""}`}
                          value={form.firstName}
                          onChange={(e) =>
                            updateForm("firstName", e.target.value)
                          }
                        />
                        {errors.firstName && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>
                          {" "}
                          Last Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="Enter last name"
                          className="mt-1 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff]"
                          value={form.lastName}
                          onChange={(e) =>
                            updateForm("lastName", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Primary Contact Information Section */}
                  <div>
                    <h2 className="text-md font-semibold text-gray-900 mb-4">
                      Primary Contact Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>
                          Email <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            className={`pl-10 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.email ? "border-red-500 focus:ring-red-500" : ""} ${editCustomer ? "bg-gray-100 cursor-not-allowed" : ""}`}
                            value={form.email}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase();
                              updateForm("email", value);
                              // Check if alternate emails match this email
                              const trimmedValue = value.trim();
                              if (
                                trimmedValue &&
                                form.alternateEmail1?.toLowerCase().trim() ===
                                  trimmedValue
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail1:
                                    "Cannot be same as primary email",
                                }));
                              } else if (
                                errors.alternateEmail1 ===
                                "Cannot be same as primary email"
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail1: "",
                                }));
                              }
                              if (
                                trimmedValue &&
                                form.alternateEmail2?.toLowerCase().trim() ===
                                  trimmedValue
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail2:
                                    "Cannot be same as primary email",
                                }));
                              } else if (
                                errors.alternateEmail2 ===
                                "Cannot be same as primary email"
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail2: "",
                                }));
                              }
                            }}
                            disabled={!!editCustomer}
                          />
                        </div>
                        {errors.email && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.email}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>
                          Phone Number <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative mt-1">
                          <PhoneCallIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="tel"
                            placeholder="1234567890"
                            className={`pl-10 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.phone ? "border-red-500 focus:ring-red-500" : ""}`}
                            value={form.phone}
                            onChange={(e) => {
                              // Only allow digits and limit to 10 digits
                              const value = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10);
                              updateForm("phone", value);
                              // Check if alternate phone matches this phone
                              if (
                                value.length === 10 &&
                                form.alternatePhone &&
                                form.alternatePhone.replace(/\D/g, "") === value
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternatePhone:
                                    "Cannot be same as primary phone",
                                }));
                              } else if (
                                errors.alternatePhone ===
                                "Cannot be same as primary phone"
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternatePhone: "",
                                }));
                              }
                            }}
                            maxLength={10}
                          />
                        </div>
                        {errors.phone && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Customer Title</Label>
                        <Input
                          placeholder="Enter title"
                          className={`mt-1 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${
                            errors.Customer_title
                              ? "border-red-500 focus:ring-red-500"
                              : ""
                          }`}
                          value={form.Customer_title}
                          onChange={(e) =>
                            updateForm("Customer_title", e.target.value)
                          }
                        />
                        {errors.Customer_title && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.Customer_title}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alternate Contact Information Section */}
                  <div>
                    <h2 className="text-md font-semibold text-gray-900 mb-4">
                      Alternate Contact Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Alternate Email 1</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="alternate1@example.com"
                            className={`pl-10 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.alternateEmail1 ? "border-red-500 focus:ring-red-500" : ""}`}
                            value={form.alternateEmail1}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase();
                              updateForm("alternateEmail1", value);
                              // Clear error if valid
                              const trimmedValue = value.trim();
                              if (trimmedValue) {
                                if (
                                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                    trimmedValue,
                                  )
                                ) {
                                  // Check for duplicates
                                  if (
                                    trimmedValue ===
                                    form.email?.toLowerCase().trim()
                                  ) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail1:
                                        "Cannot be same as primary email",
                                    }));
                                  } else if (
                                    trimmedValue ===
                                    form.alternateEmail2?.toLowerCase().trim()
                                  ) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail1:
                                        "Cannot be same as alternate email 2",
                                    }));
                                  } else {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail1: "",
                                    }));
                                  }
                                }
                              } else {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail1: "",
                                }));
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value) {
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail1: "Invalid email format",
                                  }));
                                } else if (
                                  value.toLowerCase() ===
                                  form.email?.toLowerCase().trim()
                                ) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail1:
                                      "Cannot be same as primary email",
                                  }));
                                } else if (
                                  value.toLowerCase() ===
                                  form.alternateEmail2?.toLowerCase().trim()
                                ) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail1:
                                      "Cannot be same as alternate email 2",
                                  }));
                                }
                              }
                            }}
                          />
                        </div>
                        {errors.alternateEmail1 && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.alternateEmail1}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Alternate Email 2</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="alternate2@example.com"
                            className={`pl-10 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.alternateEmail2 ? "border-red-500 focus:ring-red-500" : ""}`}
                            value={form.alternateEmail2}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase();
                              updateForm("alternateEmail2", value);
                              // Clear error if valid
                              const trimmedValue = value.trim();
                              if (trimmedValue) {
                                if (
                                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                    trimmedValue,
                                  )
                                ) {
                                  // Check for duplicates
                                  if (
                                    trimmedValue ===
                                    form.email?.toLowerCase().trim()
                                  ) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail2:
                                        "Cannot be same as primary email",
                                    }));
                                  } else if (
                                    trimmedValue ===
                                    form.alternateEmail1?.toLowerCase().trim()
                                  ) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail2:
                                        "Cannot be same as alternate email 1",
                                    }));
                                  } else {
                                    setErrors((prev) => ({
                                      ...prev,
                                      alternateEmail2: "",
                                    }));
                                  }
                                }
                              } else {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternateEmail2: "",
                                }));
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value) {
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail2: "Invalid email format",
                                  }));
                                } else if (
                                  value.toLowerCase() ===
                                  form.email?.toLowerCase().trim()
                                ) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail2:
                                      "Cannot be same as primary email",
                                  }));
                                } else if (
                                  value.toLowerCase() ===
                                  form.alternateEmail1?.toLowerCase().trim()
                                ) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternateEmail2:
                                      "Cannot be same as alternate email 1",
                                  }));
                                }
                              }
                            }}
                          />
                        </div>
                        {errors.alternateEmail2 && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.alternateEmail2}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Alternate Phone</Label>
                        <div className="relative mt-1">
                          <PhoneCallIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="tel"
                            placeholder="1234567890"
                            className={`pl-10 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.alternatePhone ? "border-red-500 focus:ring-red-500" : ""}`}
                            value={form.alternatePhone}
                            onChange={(e) => {
                              // Only allow digits and limit to 10 digits
                              const value = e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10);
                              updateForm("alternatePhone", value);
                              // Clear error if phone is valid (10 digits) and not duplicate
                              if (value.length === 10) {
                                if (value === form.phone) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternatePhone:
                                      "Cannot be same as primary phone",
                                  }));
                                } else {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternatePhone: "",
                                  }));
                                }
                              } else if (
                                value.length > 0 &&
                                value.length < 10
                              ) {
                                // Clear duplicate error if phone is being edited
                                if (
                                  errors.alternatePhone ===
                                  "Cannot be same as primary phone"
                                ) {
                                  setErrors((prev) => ({
                                    ...prev,
                                    alternatePhone: "",
                                  }));
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              if (value.length > 0 && value.length !== 10) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternatePhone:
                                    "Phone number must be exactly 10 digits",
                                }));
                              } else if (
                                value.length === 10 &&
                                value === form.phone
                              ) {
                                setErrors((prev) => ({
                                  ...prev,
                                  alternatePhone:
                                    "Cannot be same as primary phone",
                                }));
                              }
                            }}
                            maxLength={10}
                          />
                        </div>
                        {errors.alternatePhone && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.alternatePhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address & Delivery Information Section */}
                  <div>
                    <h2 className="text-md font-semibold text-gray-900 mb-4">
                      Address & Delivery Information
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <Label>
                          Delivery Address{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <AddressAutocomplete
                          value={form.address}
                          onChange={(value) => updateForm("address", value)}
                          className={`mt-1 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] ${errors.address ? "border-red-500 focus:ring-red-500" : ""}`}
                          placeholder="Enter full address"
                        />
                        {errors.address && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors.address}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Zone/City Names</Label>
                          <Input
                            placeholder="Enter zone or city name"
                            className="mt-1 h-10 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff]"
                            value={form.zoneCity}
                            onChange={(e) =>
                              updateForm("zoneCity", e.target.value)
                            }
                          />
                        </div>
                        {form.company && (
                          <div>
                            <Label className="text-gray-700 text-sm">
                              Delivery Zone
                            </Label>
                            <p className="mt-1 text-sm text-gray-600 py-2 px-3 rounded-md border border-gray-200 bg-gray-50">
                              {form.deliveryZoneName || "—"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              From selected company
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Company Logo Section */}
                  {logoPreview && (
                    <div>
                      <h2 className="text-md font-semibold text-gray-900 mb-4">
                        Company Logo
                      </h2>
                      <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                        <img
                          src={logoPreview}
                          alt="Company logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Logo from selected company
                      </p>
                    </div>
                  )}

                  {/* Notes Section */}
                  <div>
                    <h2 className="text-md font-semibold text-gray-900 mb-4">
                      Notes (Optional)
                    </h2>
                    <Textarea
                      placeholder="Add any important notes about this customer (e.g., special pricing agreements, delivery instructions, preferences, etc.)"
                      className="min-h-32 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-[#00a1ff] resize-none"
                      value={form.notes}
                      onChange={(e) => updateForm("notes", e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      These notes will be visible to all staff members and can
                      help track important customer information.
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4 mt-8">
                  <div className="  mx-auto px-6 flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                      className="text-gray-600 hover:text-gray-900 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold px-6"
                    >
                      {loading ? (
                        <>Saving...</>
                      ) : editCustomer ? (
                        "Update Customer"
                      ) : (
                        "Save Customer"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <div className="flex justify-evenly text-center gap-2">
          <h2
            className="text-2xl font-semibold text-gray-900 w-[50%] bg-[#c6dff5] p-2 cursor-pointer"
            onClick={() => router.push("/admin/company")}
          >
            All Companies
          </h2>
          <h2 className={`text-2xl font-semibold text-gray-900 w-[50%] ${pathname === "/admin/customers" ? "bg-white":"bg-[#c6dff5]"} p-2 cursor-pointer`}>
            All Customers ({sortedCustomers.length})
          </h2>
        </div>
        <table
          className="w-full text-sm text-left"
          style={{ tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: "14%" }} /> {/* Company */}
            <col style={{ width: "14%" }} /> {/* Contact */}
            <col style={{ width: "10%" }} /> {/* Account Status */}
            <col style={{ width: "14%" }} /> {/* Email */}
            <col style={{ width: "12%" }} /> {/* Phone */}
            <col style={{ width: "10%" }} /> {/* Zone */}
            <col style={{ width: "8%" }} /> {/* Total Orders */}
            <col style={{ width: "10%" }} /> {/* Last Order */}
            <col style={{ width: "8%" }} /> {/* Status */}
            <col style={{ width: "10%" }} /> {/* Actions */}
          </colgroup>

          <thead className="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("company")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Company</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "company" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("contact")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Contact Name</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "contact" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>

              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("account")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Account Type</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "account" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>

              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Email</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "email" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("phone")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Phone</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "phone" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("zone")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Zone</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "zone" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("total_orders")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Total Orders</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "total_orders" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("last_order")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Last Order</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "last_order" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th
                className="p-3 cursor-pointer hover:bg-slate-200 select-none"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center relative pr-4">
                  <span className="whitespace-nowrap">Status</span>
                  <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                    {sortColumn === "status" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </div>
              </th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCustomers.map((cust) => (
              <tr
                key={cust.id}
                className={`border-b hover:bg-slate-50 ${cust.account_status === true && "bg-slate-200"}`}
              >
                <td className="p-3 font-medium truncate">
                  {cust.company_name}
                </td>
                <td className="px-6 py-3 overflow-hidden">
                  <div
                    className={`font-medium truncate ${cust.status === "active" ? "text-gray-800" : "text-gray-400"}`}
                  >
                    {cust.first_name} {cust.last_name}
                  </div>
                </td>
                <td className="p-3 font-medium truncate">
                  {cust.account_status === true ? "Accounts" : "Customer"}
                </td>
                <td className="p-3 truncate">
                  <a
                    href={`mailto:${cust.email}`}
                    className={`truncate block ${
                      cust.status === "active"
                        ? "text-sky-600 hover:underline"
                        : "text-gray-400 cursor-not-allowed pointer-events-none"
                    }`}
                  >
                    {cust.email}
                  </a>
                </td>
                <td className="p-3 truncate">
                  <a
                    href={`tel:${cust.phone}`}
                    className={`truncate block ${
                      cust.status === "active"
                        ? "text-sky-600 hover:underline"
                        : "text-gray-400 cursor-not-allowed pointer-events-none"
                    }`}
                  >
                    {cust.phone}
                  </a>
                </td>
                <td className="p-3 truncate">{cust.delivery_zone || "—"}</td>
                <td className="p-3 text-center">{cust.total_orders ?? 0}</td>
                <td className="p-3 truncate">
                  {cust.last_order && cust.last_order !== "—"
                    ? new Date(cust.last_order).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3">
                  <Switch
                    checked={cust.status === "active"}
                    onCheckedChange={() => handleToggleStatus(cust)}
                    className={
                      cust.status === "active"
                        ? "data-[state=checked]:bg-[#00a1ff]"
                        : "data-[state=unchecked]:bg-gray-300"
                    }
                  />
                </td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(cust)}
                      className="text-blue-600 bg-blue-100 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(cust)}
                      className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(cust)}
                      className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {/* <Button variant="outline" size="icon" onClick={() => handleViewPricing(cust)}>
                    <DollarSign className="h-4 w-4" />
                  </Button> */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination Controls */}
        {sortedCustomers.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing {indexOfFirstItem + 1}–
                {Math.min(indexOfLastItem, sortedCustomers.length)} of{" "}
                {sortedCustomers.length}
              </p>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="itemsPerPage"
                  className="text-sm text-gray-600 whitespace-nowrap"
                >
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
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={indexOfLastItem >= sortedCustomers.length}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {sortedCustomers.length === 0 && (
          <div className="text-center text-slate-500 py-6 border-t">
            {searchTerm
              ? "No customers found matching your search."
              : "No customers found."}
          </div>
        )}
      </div>

      {/* ---------- VIEW DETAILS FULL PAGE ---------- */}
      {viewPageOpen && viewCustomer && (
        <div className="fixed left-64 right-0 top-0 bottom-0 z-50 bg-gray-100 overflow-y-auto">
          <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
              <div className="mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setViewPageOpen(false);
                      setViewCustomer(null);
                    }}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Back to Customers
                    </span>
                  </button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      {viewCustomer.company_name}
                    </h1>
                    <p className="text-sm text-gray-500">Customer Details</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      viewCustomer.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {viewCustomer.status === "active"
                      ? "Active"
                      : viewCustomer.status || "Active"}
                  </span>
                  <Button
                    onClick={() => {
                      setViewPageOpen(false);
                      handleEdit(viewCustomer);
                    }}
                    className="bg-[#00a1ff] hover:bg-[#0090e6] text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Customer
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="mx-auto px-6 py-8 ">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Contact Information Card */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="h-5 w-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        Contact Information
                      </h2>
                    </div>
                    <div className=" grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Contact Name
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {viewCustomer.first_name} {viewCustomer.last_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Company Name
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {viewCustomer.company_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Email Address
                        </p>
                        <a
                          href={`mailto:${viewCustomer.email}`}
                          className="text-base font-medium text-[#00a1ff] hover:underline"
                        >
                          {viewCustomer.email}
                        </a>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Phone Number
                        </p>
                        <a
                          href={`tel:${viewCustomer.phone}`}
                          className="text-base font-medium text-[#00a1ff] hover:underline"
                        >
                          {viewCustomer.phone}
                        </a>
                      </div>
                      {viewCustomer.alternateEmail1 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">
                            Alternate Email 1
                          </p>
                          <a
                            href={`mailto:${viewCustomer.alternateEmail1}`}
                            className="text-base font-medium text-[#00a1ff] hover:underline"
                          >
                            {viewCustomer.alternateEmail1}
                          </a>
                        </div>
                      )}
                      {viewCustomer.alternateEmail2 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">
                            Alternate Email 2
                          </p>
                          <a
                            href={`mailto:${viewCustomer.alternateEmail2}`}
                            className="text-base font-medium text-[#00a1ff] hover:underline"
                          >
                            {viewCustomer.alternateEmail2}
                          </a>
                        </div>
                      )}
                      {viewCustomer.alternatePhone && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">
                            Alternate Phone
                          </p>
                          <a
                            href={`tel:${viewCustomer.alternatePhone}`}
                            className="text-base font-medium text-[#00a1ff] hover:underline"
                          >
                            {viewCustomer.alternatePhone}
                          </a>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Delivery Address
                        </p>
                        <div className="text-base font-medium text-gray-900">
                          {(() => {
                            const addr: any = viewCustomer.delivery_address;
                            if (!addr) return <span>—</span>;

                            // Handle string address
                            if (typeof addr === "string") {
                              try {
                                // Try to parse as JSON
                                const parsed: any = JSON.parse(addr);
                                if (Array.isArray(parsed)) {
                                  return (
                                    <div className="space-y-2">
                                      {parsed.map(
                                        (address: any, index: number) => {
                                          const parts = [
                                            address.street,
                                            address.city,
                                            address.state,
                                            address.zipCode,
                                          ].filter(Boolean);
                                          const formattedAddr =
                                            parts.join(", ") ||
                                            address.address ||
                                            address.formatted_address ||
                                            "";
                                          return (
                                            <div
                                              key={address.id || index}
                                              className="flex items-start gap-2"
                                            >
                                              <span className="font-semibold text-blue-600">
                                                {address.label ||
                                                  `Address ${index + 1}`}
                                                :
                                              </span>
                                              <span className="text-xs">
                                                {formattedAddr}
                                              </span>
                                              {address.isSelected && (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                  Selected
                                                </span>
                                              )}
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  );
                                }
                              } catch {
                                // Not JSON, return as string
                                return <span className="text-xs">{addr}</span>;
                              }
                              return <span className="text-xs">{addr}</span>;
                            }

                            // Handle array of addresses
                            if (Array.isArray(addr)) {
                              return (
                                <div className="space-y-2">
                                  {(addr as any[]).map(
                                    (address: any, index: number) => {
                                      const parts = [
                                        address.street,
                                        address.city,
                                        address.state,
                                        address.zipCode,
                                      ].filter(Boolean);
                                      const formattedAddr =
                                        parts.join(", ") ||
                                        address.address ||
                                        address.formatted_address ||
                                        "";
                                      return (
                                        <div
                                          key={address.id || index}
                                          className="flex items-center gap-2"
                                        >
                                          <span className="font-semibold text-xs text-blue-600">
                                            {address.label ||
                                              `Address ${index + 1}`}
                                            :
                                          </span>
                                          <span className="text-xs">
                                            {formattedAddr}
                                          </span>
                                          {address.isSelected && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                              Selected
                                            </span>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              );
                            }

                            // Handle single object
                            if (typeof addr === "object" && addr !== null) {
                              const addrObj = addr as Record<string, any>;
                              if (
                                addrObj?.address &&
                                typeof addrObj.address === "string"
                              ) {
                                return (
                                  <span className="text-xs">
                                    {addrObj.address}
                                  </span>
                                );
                              }
                              if (
                                addrObj?.formatted_address &&
                                typeof addrObj.formatted_address === "string"
                              ) {
                                return (
                                  <span className="text-xs">
                                    {addrObj.formatted_address}
                                  </span>
                                );
                              }
                              // Format from object parts
                              const parts = [
                                addrObj.street,
                                addrObj.city,
                                addrObj.state,
                                addrObj.zipCode,
                              ].filter(Boolean);
                              if (parts.length > 0) {
                                return (
                                  <span className="text-xs">
                                    {parts.join(", ")}
                                  </span>
                                );
                              }
                            }

                            return <span>—</span>;
                          })()}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Delivery Zone
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {viewCustomer.delivery_zone || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Documents Card */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                          Documents
                        </h2>
                      </div>
                      {(() => {
                        const resaleCert = viewCustomer.resale_certificate;
                        const resaleIsArray = Array.isArray(resaleCert);
                        const resaleIsString =
                          typeof resaleCert === "string" &&
                          resaleCert.startsWith("http");
                        const resaleCount = resaleIsArray
                          ? resaleCert.length
                          : resaleIsString
                            ? 1
                            : 0;

                        const otherDocs = Array.isArray(
                          viewCustomer.other_documents,
                        )
                          ? viewCustomer.other_documents
                          : [];
                        const generalDocs = Array.isArray(
                          viewCustomer.documents,
                        )
                          ? viewCustomer.documents
                          : [];

                        const totalCount =
                          resaleCount +
                          otherDocs.length +
                          generalDocs.length +
                          (viewCustomer.companyLogo ? 1 : 0);
                        return (
                          <span className="text-sm text-gray-500">
                            {totalCount} document{totalCount !== 1 ? "s" : ""}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        // Parse documents from different fields
                        const resaleCert = viewCustomer.resale_certificate;
                        let resaleDocs: any[] = [];

                        if (resaleCert) {
                          if (Array.isArray(resaleCert)) {
                            resaleDocs = resaleCert;
                          } else if (typeof resaleCert === "string") {
                            // Check if it's a URL string
                            if (resaleCert.startsWith("http")) {
                              // It's a single URL, create a document object
                              const fileName =
                                resaleCert.split("/").pop() ||
                                "resale-certificate.jpg";
                              resaleDocs = [
                                {
                                  id: "resale-cert",
                                  name: fileName,
                                  url: resaleCert,
                                  type:
                                    fileName.split(".").pop()?.toUpperCase() ||
                                    "JPG",
                                  uploadedAt: new Date().toISOString(),
                                },
                              ];
                            } else {
                              // Try to parse as JSON
                              try {
                                const parsed = JSON.parse(resaleCert);
                                resaleDocs = Array.isArray(parsed)
                                  ? parsed
                                  : [parsed];
                              } catch {
                                // Not JSON, treat as single URL
                                resaleDocs = [
                                  {
                                    id: "resale-cert",
                                    name: "resale-certificate.jpg",
                                    url: resaleCert,
                                    type: "JPG",
                                    uploadedAt: new Date().toISOString(),
                                  },
                                ];
                              }
                            }
                          }
                        }

                        const otherDocs: any[] = Array.isArray(
                          viewCustomer.other_documents,
                        )
                          ? viewCustomer.other_documents
                          : typeof viewCustomer.other_documents === "string"
                            ? (() => {
                                try {
                                  return JSON.parse(
                                    viewCustomer.other_documents,
                                  );
                                } catch {
                                  return [];
                                }
                              })()
                            : [];

                        const generalDocs: any[] = Array.isArray(
                          viewCustomer.documents,
                        )
                          ? viewCustomer.documents
                          : typeof viewCustomer.documents === "string"
                            ? (() => {
                                try {
                                  return JSON.parse(viewCustomer.documents);
                                } catch {
                                  return [];
                                }
                              })()
                            : [];

                        const companyLogo = viewCustomer.companyLogo;

                        const hasAnyDocs =
                          resaleDocs.length > 0 ||
                          otherDocs.length > 0 ||
                          generalDocs.length > 0 ||
                          companyLogo;

                        if (!hasAnyDocs) {
                          return (
                            <>
                              <div className="text-sm text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                                No documents uploaded yet
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                                <p className="text-sm text-blue-800">
                                  Customers can upload documents through the
                                  mobile app's Document Center. Documents
                                  include company logos, resale certificates,
                                  and other business documents.
                                </p>
                              </div>
                            </>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {/* Company Logo */}
                            {companyLogo && (
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center gap-2 mb-3">
                                  <ImageIcon className="h-4 w-4 text-blue-600" />
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    Company Logo
                                  </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 bg-white flex items-center justify-center">
                                    <img
                                      src={companyLogo}
                                      alt="Company Logo"
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        (
                                          e.target as HTMLImageElement
                                        ).style.display = "none";
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      Company Logo
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Image file
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      window.open(companyLogo, "_blank")
                                    }
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Resale Certificates */}
                            {resaleDocs.length > 0 && (
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="h-4 w-4 text-green-600" />
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    Resale Certificates
                                  </h3>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                    {resaleDocs.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {resaleDocs.map((doc: any, index: number) => (
                                    <div
                                      key={doc.id || index}
                                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                                          <FileText className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">
                                            {doc.name ||
                                              `Document ${index + 1}`}
                                          </p>
                                          <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{doc.type || "File"}</span>
                                            {doc.size && (
                                              <span>
                                                • {Math.round(doc.size / 1024)}{" "}
                                                KB
                                              </span>
                                            )}
                                            {doc.uploadedAt && (
                                              <span>
                                                •{" "}
                                                {new Date(
                                                  doc.uploadedAt,
                                                ).toLocaleDateString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            window.open(doc.url, "_blank")
                                          }
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          View
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Other Documents */}
                            {otherDocs.length > 0 && (
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="h-4 w-4 text-purple-600" />
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    Other Documents
                                  </h3>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                    {otherDocs.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {otherDocs.map((doc: any, index: number) => (
                                    <div
                                      key={doc.id || index}
                                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center flex-shrink-0">
                                          <FileText className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">
                                            {doc.name ||
                                              `Document ${index + 1}`}
                                          </p>
                                          <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{doc.type || "File"}</span>
                                            {doc.size && (
                                              <span>
                                                • {Math.round(doc.size / 1024)}{" "}
                                                KB
                                              </span>
                                            )}
                                            {doc.uploadedAt && (
                                              <span>
                                                •{" "}
                                                {new Date(
                                                  doc.uploadedAt,
                                                ).toLocaleDateString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            window.open(doc.url, "_blank")
                                          }
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          View
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* General Documents */}
                            {generalDocs.length > 0 && (
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    Documents
                                  </h3>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                    {generalDocs.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {generalDocs.map(
                                    (doc: any, index: number) => (
                                      <div
                                        key={doc.id || index}
                                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {doc.name ||
                                                `Document ${index + 1}`}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                              <span>{doc.type || "File"}</span>
                                              {doc.size && (
                                                <span>
                                                  •{" "}
                                                  {Math.round(doc.size / 1024)}{" "}
                                                  KB
                                                </span>
                                              )}
                                              {doc.uploadedAt && (
                                                <span>
                                                  •{" "}
                                                  {new Date(
                                                    doc.uploadedAt,
                                                  ).toLocaleDateString()}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              window.open(doc.url, "_blank")
                                            }
                                          >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View
                                          </Button>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Notes Card */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <StickyNote className="h-5 w-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        Notes
                      </h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Customer Notes</p>
                    {viewCustomer.notes ? (
                      <div className="space-y-3">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm text-gray-600">
                              {viewCustomer.notes}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-yellow-200">
                            <span className="text-xs text-gray-500">
                              {viewCustomer.created_at
                                ? new Date(
                                    viewCustomer.created_at,
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                  })
                                : viewCustomer.registration_date
                                  ? new Date(
                                      viewCustomer.registration_date,
                                    ).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                    })
                                  : new Date().toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                    })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {viewCustomer.first_name} {viewCustomer.last_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No notes available
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Account Summary Card */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        Account Summary
                      </h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Registration Date
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {viewCustomer.created_at
                            ? new Date(viewCustomer.created_at)
                                .toISOString()
                                .split("T")[0]
                            : viewCustomer.registration_date
                              ? new Date(viewCustomer.registration_date)
                                  .toISOString()
                                  .split("T")[0]
                              : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Account Status
                        </p>
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                            viewCustomer.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {viewCustomer.status === "active"
                            ? "Active"
                            : viewCustomer.status || "Active"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Order Statistics Card */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="h-5 w-5 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-900">
                        Order Statistics
                      </h2>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Total Orders
                        </p>
                        <p className="text-3xl font-bold text-[#00a1ff]">
                          {viewCustomer.total_orders || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          Last Order Date
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {viewCustomer.last_order &&
                          viewCustomer.last_order !== "—"
                            ? new Date(viewCustomer.last_order)
                                .toISOString()
                                .split("T")[0]
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- EXISTING PRICING MODAL ---------- */}
      <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Manage Pricing for {pricingCustomer?.company_name || ""}
            </DialogTitle>
            <DialogDescription>
              View or update pricing for this customer.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Custom Pricing</Label>
              <div
                onClick={() =>
                  setCustomPricing((p) => ({ ...p, enabled: !p.enabled }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition ${
                  customPricing.enabled ? "bg-[#00a1ff]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform bg-white rounded-full transition ${
                    customPricing.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </div>

            {customPricing.enabled && (
              <>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-500 font-medium mb-2">
                    Standard Pricing (Current)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Price per Case</Label>
                      <Input
                        readOnly
                        value=""
                        className="bg-gray-100 text-gray-700"
                      />
                    </div>
                    <div>
                      <Label>Price per Unit</Label>
                      <Input
                        readOnly
                        value=""
                        className="bg-gray-100 text-gray-700"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 font-medium mb-2">
                    Update Pricing
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Price per Case</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={customPricing.case}
                        onChange={(e) =>
                          setCustomPricing((p) => ({
                            ...p,
                            case: e.target.value,
                          }))
                        }
                        placeholder="Enter new price"
                      />
                    </div>
                    <div>
                      <Label>Price per Unit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={customPricing.unit}
                        onChange={(e) =>
                          setCustomPricing((p) => ({
                            ...p,
                            unit: e.target.value,
                          }))
                        }
                        placeholder="Enter new price"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSavePricing}
              className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold"
            >
              Save Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{customerToDelete?.company_name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
