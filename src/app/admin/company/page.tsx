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
  Plus,
  Edit,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Building,
  Upload,
  X,
  ArrowLeft,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Autocomplete from "react-google-autocomplete";

// import { Mail, PhoneCall } from "lucide-react";
import CustomerForm from "./CustomerForm";

interface Company {
  id: string;
  company_name: string;
  email?: string | null;
  phone_number: string;
  address: string;
  franchise_id: string | null;
  created_at: string;
  franchise_name?: string; // Added for display
  companyLogo?: string;
  status?: string;
  delivery_zone?: string | null;
  delivery_zone_name?: string | null;
  DBA?: string | null;
}

interface Franchise {
  id: string;
  franchise_name: string;
}

interface DeliveryZone {
  id: string;
  zone_name: string;
  description: string | null;
  status: string;
  franchise_id?: string | null;
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
  useEffect(() => {
    // Add CSS to ensure Google Places Autocomplete dropdown appears above modals
    const style = document.createElement("style");
    style.textContent = `
      .pac-container {
        z-index: 9999 !important;
        pointer-events: all !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Autocomplete
      apiKey="AIzaSyCCgZ0nPPzDypuEIOQKgb6DeOE-DBJBsGE"
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

export default function CompanyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [open, setOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdCompany, setCreatedCompany] = useState<any | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone_number: "",
    address: "",
    franchise_id: "",
    companyLogo: "",
    delivery_zone: "",
    delivery_zone_name: "",
    DBA: "",
  });
  const [customerLoading, setCustomerLoading] = useState(false);

  const [customerForm, setCustomerForm] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerPhone: "",
    Customer_title: "",
    alternateEmail1: "",
    alternateEmail2: "",
  });

  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>(
    {},
  );
  const [useSameAsMain, setUseSameAsMain] = useState(false);

  const [accountForm, setAccountForm] = useState({
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerPhone: "",
    Customer_title: "",
    alternateEmail1: "",
    alternateEmail2: "",
  });

  const [accountErrors, setAccountErrors] = useState<Record<string, string>>(
    {},
  );

  const updateAccount = (key: keyof typeof accountForm, value: string) => {
    setAccountForm((prev) => ({ ...prev, [key]: value }));
    setAccountErrors((prev) => ({ ...prev, [key]: "" }));
  };

  useEffect(() => {
    if (useSameAsMain) {
      setAccountForm({
        customerFirstName: "",
        customerLastName: "",
        customerEmail: "",
        customerPhone: "",
        Customer_title: "",
        alternateEmail1: "",
        alternateEmail2: "",
      });
      setAccountErrors({});
    }
  }, [useSameAsMain]);

  const isAnyAccountFieldFilled = () => {
    return (
      accountForm.customerFirstName.trim() ||
      accountForm.customerLastName.trim() ||
      accountForm.customerEmail.trim() ||
      accountForm.customerPhone.trim() ||
      accountForm.Customer_title.trim()
    );
  };

  const validateAccountIfNeeded = () => {
    // checkbox ON => no validation (because form hidden)
    if (useSameAsMain) {
      setAccountErrors({});
      return true;
    }

    // if user didn't fill anything => skip validation
    if (!isAnyAccountFieldFilled()) {
      setAccountErrors({});
      return true;
    }

    // if any filled => require full validation
    const e: Record<string, string> = {};

    if (!accountForm.customerFirstName.trim())
      e.customerFirstName = "First name required";

    if (!accountForm.customerEmail.trim()) e.customerEmail = "Email required";
    else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.customerEmail.trim())
    )
      e.customerEmail = "Invalid email";

    if (!accountForm.customerPhone.trim()) e.customerPhone = "Phone required";
    else if (accountForm.customerPhone.replace(/\D/g, "").length !== 10)
      e.customerPhone = "Phone must be 10 digits";

    setAccountErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAccountCustomerInsertOnly = async (company: any) => {
    // checkbox ON => skip (because same-as-main)
    if (useSameAsMain) return;

    // if nothing filled => skip
    if (!isAnyAccountFieldFilled()) return;

    // must be valid (you already validate before calling)
    const customerEmail = accountForm.customerEmail.trim().toLowerCase();
    const customerPhone = accountForm.customerPhone.replace(/\D/g, "");

    const customerPayload = {
      company_name: company.company_name,
      first_name: accountForm.customerFirstName.trim(),
      last_name: accountForm.customerLastName.trim(),
      email: customerEmail,
      phone: customerPhone,
      Customer_title: accountForm.Customer_title,
      delivery_address: company.address,
      delivery_zone: company.delivery_zone,
      delivery_zone_name: company.delivery_zone_name,

      zoneCity: null,
      created_by_email: null,
      alternateEmail1: accountForm.alternateEmail1?.trim() || null,
      alternateEmail2: accountForm.alternateEmail2?.trim() || null,
      alternatePhone: null,

      company_id: company.id,
      notes: null,
      password: null, // optional: or remove if db allows
      status: "active",
      franchise_id: company.franchise_id,

      // ✅ as you said
      account_status: true,
    };

    const { error: insertErr } = await supabase
      .from("customers")
      .insert(customerPayload);

    if (insertErr) throw insertErr;

    // optional reset
    setAccountForm({
      customerFirstName: "",
      customerLastName: "",
      customerEmail: "",
      customerPhone: "",
      Customer_title: "",
      alternateEmail1: "",
      alternateEmail2: "",

    });
    setAccountErrors({});
  };

  // Filter companies based on search term
  const filteredCompanies = companies.filter((company) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      company.company_name?.toLowerCase().includes(search) ||
      company.email?.toLowerCase().includes(search) ||
      company.phone_number?.toLowerCase().includes(search) ||
      company.address?.toLowerCase().includes(search)
    );
  });

  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (!sortColumn) {
      // Default: sort by created_at descending (newest first)
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    }

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "company_name":
        aValue = a.company_name || "";
        bValue = b.company_name || "";
        break;
      case "email":
        aValue = a.email || "";
        bValue = b.email || "";
        break;
      case "phone_number":
        aValue = a.phone_number || "";
        bValue = b.phone_number || "";
        break;
      case "address":
        aValue = a.address || "";
        bValue = b.address || "";
        break;
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case "status":
        aValue = (a.status || "active").toLowerCase();
        bValue = (b.status || "active").toLowerCase();
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
  const currentCompanies = sortedCompanies.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(sortedCompanies.length / itemsPerPage);

  const updateForm = (key: string, value: any) => {
    setForm((p: any) => ({ ...p, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const resetForm = () => {
    setForm({
      company_name: "",
      email: "",
      phone_number: "",
      address: "",
      franchise_id: "",
      companyLogo: "",
      delivery_zone: "",
      delivery_zone_name: "",
      DBA: "",
    });
    setLogoPreview(null);
    setEditCompany(null);
    setErrors({});
  };

  useEffect(() => {
    const checkSuperAdmin = () => {
      const superAdmin =
        typeof window !== "undefined"
          ? localStorage.getItem("is_super_admin") === "true"
          : false;
      setIsSuperAdmin(superAdmin);

      if (superAdmin) {
        fetchFranchises();
      }
    };

    checkSuperAdmin();
    fetchData();

    // Add global style to ensure Google Places Autocomplete dropdown appears above modals
    const style = document.createElement("style");
    style.id = "google-places-autocomplete-zindex";
    style.textContent = `
      .pac-container {
        z-index: 99999 !important;
      }
    `;
    if (!document.getElementById("google-places-autocomplete-zindex")) {
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.getElementById(
        "google-places-autocomplete-zindex",
      );
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  const fetchFranchises = async () => {
    try {
      const { data, error } = await supabase
        .from("franchises")
        .select("id, franchise_name")
        .order("franchise_name", { ascending: true });

      if (error) {
        console.error("Error fetching franchises:", error);
        return;
      }

      setFranchises(data || []);
    } catch (err) {
      console.error("Fetch franchises error:", err);
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      const isSuperAdmin =
        typeof window !== "undefined" &&
        localStorage.getItem("is_super_admin") === "true";
      const currentFranchiseId =
        typeof window !== "undefined"
          ? localStorage.getItem("current_franchise_id")
          : null;
      let query = supabase
        .from("delivery_zones")
        .select("id, zone_name, description, status, franchise_id")
        .eq("status", "Active")
        .order("zone_name", { ascending: true });
      // Super Admin: show all delivery zones (no franchise filter)
      if (!isSuperAdmin && currentFranchiseId) {
        query = query.eq("franchise_id", currentFranchiseId);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching delivery zones:", error);
        return;
      }
      setDeliveryZones(data || []);
    } catch (err) {
      console.error("Fetch delivery zones error:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
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

      let companyQuery = supabase.from("company").select("*");

      // Filter based on user role:
      // Super Admin: Show ALL companies (no filter)
      // Franchise: Show only companies where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees ALL companies (no filter applied)
        // Don't apply any filter - show all data
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        companyQuery = companyQuery.eq("franchise_id", currentFranchiseId);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        companyQuery = companyQuery.eq("id", "-1"); // Impossible condition
      }

      // Order by created_at descending so newest companies appear first
      companyQuery = companyQuery.order("created_at", { ascending: false });

      const { data: companiesData, error: err } = await companyQuery;

      if (err) {
        console.error("Company fetch error:", err);
        toast.error("Failed to fetch companies");
      } else {
        // Fetch franchise names for companies that have franchise_id
        const companiesWithFranchise = await Promise.all(
          (companiesData || []).map(async (company) => {
            if (company.franchise_id) {
              const { data: franchiseData } = await supabase
                .from("franchises")
                .select("franchise_name")
                .eq("id", company.franchise_id)
                .maybeSingle();

              return {
                ...company,
                franchise_name:
                  franchiseData?.franchise_name || "Unknown Franchise",
                status: company.status || "active", // Default to 'active' if not set
              };
            }
            return {
              ...company,
              franchise_name: "Super Admin",
              status: company.status || "active", // Default to 'active' if not set
            };
          }),
        );

        setCompanies(companiesWithFranchise);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }

    if (!form.address.trim()) {
      newErrors.address = "Address is required";
    }

    // Super Admin: Franchise is mandatory
    if (
      isSuperAdmin &&
      (!form.franchise_id || form.franchise_id.trim() === "")
    ) {
      newErrors.franchise_id = "Franchise is required";
    }

    // if (!form.delivery_zone || form.delivery_zone.trim() === '') {
    //   newErrors.delivery_zone = 'Delivery zone is required'
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const checkCustomerEmailExists = async (email: string) => {
    const emailLower = email.trim().toLowerCase();
    if (!emailLower) return false;

    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("email", emailLower)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  };

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const checkCustomerPhoneExists = async (phone: string) => {
    const digits = normalizePhone(phone);
    if (!digits) return false;

    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", digits)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  };

  const validateSequentially = async () => {
    setCustomerErrors({});
    setAccountErrors({});

    // ✅ Step 0: if main customer me kuch bhi fill hai => required checks first
    if (isAnyCustomerFieldFilled()) {
      if (!customerForm.customerFirstName.trim()) {
        setCustomerErrors({ customerFirstName: "First name required" });
        toast.error("Main customer first name required.");
        return false;
      }

      const email = customerForm.customerEmail.trim().toLowerCase();
      if (!email) {
        setCustomerErrors({ customerEmail: "Email required" });
        toast.error("Main customer email required.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setCustomerErrors({ customerEmail: "Invalid email" });
        toast.error("Main customer email invalid.");
        return false;
      }

      const phone = normalizePhone(customerForm.customerPhone);
      if (!phone) {
        setCustomerErrors({ customerPhone: "Phone required" });
        toast.error("Main customer phone required.");
        return false;
      }
      if (phone.length !== 10) {
        setCustomerErrors({ customerPhone: "Phone must be 10 digits" });
        toast.error("Main customer phone must be 10 digits.");
        return false;
      }
      if (!customerForm.Customer_title.trim()) {
        setCustomerErrors({ Customer_title: "Title required" });
        toast.error("Main customer title required.");
        return false;
      }

      // ✅ Step 1: duplicate email
      const emailExists = await checkCustomerEmailExists(email);
      if (emailExists) {
        setCustomerErrors({ customerEmail: "Email already exists" });
        toast.error("Main customer email already exists.");
        return false;
      }

      // ✅ Step 2: duplicate phone
      const phoneExists = await checkCustomerPhoneExists(phone);
      if (phoneExists) {
        setCustomerErrors({ customerPhone: "Phone already exists" });
        toast.error("Main customer phone already exists.");
        return false;
      }
    }

    // ✅ Account person validation only when visible + any field filled
    if (!useSameAsMain && isAnyAccountFieldFilled()) {
      if (!accountForm.customerFirstName.trim()) {
        setAccountErrors({ customerFirstName: "First name required" });
        toast.error("Account person first name required.");
        return false;
      }

      const accEmail = accountForm.customerEmail.trim().toLowerCase();
      if (!accEmail) {
        setAccountErrors({ customerEmail: "Email required" });
        toast.error("Account person email required.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accEmail)) {
        setAccountErrors({ customerEmail: "Invalid email" });
        toast.error("Account person email invalid.");
        return false;
      }

      const accPhone = normalizePhone(accountForm.customerPhone);
      if (!accPhone) {
        setAccountErrors({ customerPhone: "Phone required" });
        toast.error("Account person phone required.");
        return false;
      }
      if (accPhone.length !== 10) {
        setAccountErrors({ customerPhone: "Phone must be 10 digits" });
        toast.error("Account person phone must be 10 digits.");
        return false;
      }
      if (!accountForm.Customer_title.trim()) {
        setAccountErrors({ Customer_title: "Title required" });
        toast.error("Account person title required.");
        return false;
      }

      // ✅ Step 3: duplicate acc email
      const accEmailExists = await checkCustomerEmailExists(accEmail);
      if (accEmailExists) {
        setAccountErrors({ customerEmail: "Email already exists" });
        toast.error("Account person email already exists.");
        return false;
      }

      // ✅ Step 4: duplicate acc phone
      const accPhoneExists = await checkCustomerPhoneExists(accPhone);
      if (accPhoneExists) {
        setAccountErrors({ customerPhone: "Phone already exists" });
        toast.error("Account person phone already exists.");
        return false;
      }

      // ✅ Step 5: main vs account same
      const mainEmail = customerForm.customerEmail.trim().toLowerCase();
      const mainPhone = normalizePhone(customerForm.customerPhone);

      if (mainEmail && mainEmail === accEmail) {
        setAccountErrors({ customerEmail: "Use different email" });
        toast.error("Main & account email cannot be same.");
        return false;
      }

      if (mainPhone && mainPhone === accPhone) {
        setAccountErrors({ customerPhone: "Use different phone" });
        toast.error("Main & account phone cannot be same.");
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    // ✅ company validation always
    if (!validateForm()) return;

    // ✅ customer validation only if any field filled
    // if (!validateCustomerIfNeeded()) return;
    // if (!validateAccountIfNeeded()) return;
    if (!(await validateSequentially())) return;
    setLoading(true);
    try {
      const isSuperAdmin =
        typeof window !== "undefined"
          ? localStorage.getItem("is_super_admin") === "true"
          : false;

      const currentFranchiseId =
        typeof window !== "undefined"
          ? localStorage.getItem("current_franchise_id")
          : null;

      let logoUrl: string | null = null;

      if (form.companyLogo) {
        if (typeof form.companyLogo === "string") {
          logoUrl = form.companyLogo;
        } else {
          const logoFile = form.companyLogo as any;
          if (logoFile && logoFile instanceof File) {
            try {
              const timestamp = Date.now();
              const filenameSafe = logoFile.name.replace(/\s+/g, "-");
              const path = `company-logos/${timestamp}-${filenameSafe}`;

              const bucketName = "logos";
              const uploadRes = await supabase.storage
                .from(bucketName)
                .upload(path, logoFile, { upsert: true });

              if (uploadRes.error) {
                console.error("Logo upload error:", uploadRes.error);
                logoUrl = null;
              } else {
                const { data: urlData } = supabase.storage
                  .from(bucketName)
                  .getPublicUrl(uploadRes.data.path);
                logoUrl = urlData.publicUrl;
              }
            } catch (err) {
              console.error("Error uploading logo:", err);
              logoUrl = null;
            }
          }
        }
      }

      const selectedZone = deliveryZones.find(
        (z) => String(z.id) === form.delivery_zone,
      );

      const payload: any = {
        company_name: form.company_name.trim(),
        address: form.address.trim(),
        companyLogo: logoUrl,
        status: editCompany ? editCompany.status || "active" : "active",
        delivery_zone: form.delivery_zone || null,
        delivery_zone_name:
          selectedZone?.zone_name || form.delivery_zone_name || null,
        DBA: form.DBA,
      };

      if (isSuperAdmin) payload.franchise_id = form.franchise_id || null;
      else if (currentFranchiseId) payload.franchise_id = currentFranchiseId;

      let error;
      let savedCompany: any = null;

      if (editCompany) {
        const { data, error: updateError } = await supabase
          .from("company")
          .update(payload)
          .eq("id", editCompany.id)
          .select("*")
          .single();

        error = updateError;
        savedCompany = data;
      } else {
        const { data, error: insertError } = await supabase
          .from("company")
          .insert(payload)
          .select("*")
          .single();

        error = insertError;
        savedCompany = data;
      }

      if (error) {
        console.error("Error saving company:", error);
        if (error.code === "23505") {
          toast.error("This email address is already registered.");
        } else {
          toast.error(
            editCompany
              ? "Failed to update company."
              : "Failed to create company.",
          );
        }
        return;
      }

      // ✅ set state for UI
      setCreatedCompany(savedCompany);

      // ✅ company success toast
      toast.success(
        editCompany
          ? "Company updated successfully!"
          : "Company created successfully!",
      );

      // ✅ If new company AND customer fields filled => create customer
      // (Edit company case: you can decide if you want customer creation; I’m keeping it ONLY for new company)
      if (!editCompany) {
        // 1) main customer flow (unchanged)
        if (isAnyCustomerFieldFilled()) {
          await handleCustomerSubmit(savedCompany);
        }

        // 2) account person insert-only
        try {
          await handleAccountCustomerInsertOnly(savedCompany);
        } catch (e: any) {
          console.error(e);
          toast.error(
            e?.code === "23505"
              ? "Account person email already exists"
              : "Failed to add account person",
          );
        }
      }

      await fetchData();

      setOpen(false);
      resetForm();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditCompany(company);
    setForm({
      company_name: company.company_name || "",
      email: company.email || "",
      phone_number: company.phone_number || "",
      address: company.address || "",
      franchise_id: company.franchise_id || "",
      companyLogo: company.companyLogo || "",
      delivery_zone: company.delivery_zone || "",
      delivery_zone_name: company.delivery_zone_name || "",
      DBA: company.DBA || "",
    });
    // Set logo preview if existing logo exists
    if (company.companyLogo) {
      setLogoPreview(company.companyLogo);
    } else {
      setLogoPreview(null);
    }
    setOpen(true);
  };

  const handleView = (company: Company) => {
    router.push(`/admin/company/${company.id}`);
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === "active" ? "inactive" : "active";

    try {
      // Update company status
      const { error: companyError } = await supabase
        .from("company")
        .update({ status: newStatus })
        .eq("id", company.id);

      if (companyError) {
        console.error("Company status update error:", companyError);
        toast.error("Failed to update company status. Please try again.");
        return;
      }

      // Update all customers belonging to this company with the same status
      const { error: customersError } = await supabase
        .from("customers")
        .update({ status: newStatus })
        .eq("company_name", company.company_name);

      if (customersError) {
        console.error("Customers status update error:", customersError);
        // Still show success for company update, but warn about customers
        toast.warning(
          `Company ${newStatus === "active" ? "activated" : "deactivated"}, but some customers may not have been updated.`,
        );
      } else {
        if (newStatus === "active") {
          toast.success(
            "Company and all associated customers have been activated.",
          );
        } else {
          toast.success(
            "Company and all associated customers have been deactivated.",
          );
        }
      }

      // Update local state
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === company.id ? { ...c, status: newStatus } : c,
        ),
      );

      // Refresh data to get updated customer statuses
      await fetchData();
    } catch (err) {
      console.error("Toggle status error:", err);
      toast.error("An error occurred while updating status. Please try again.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!companyToDelete) return;

    setLoading(true);
    try {
      // Check if company has any customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("company_name", companyToDelete.company_name);

      if (customersError) {
        console.error("Error checking customers:", customersError);
        toast.error("Failed to check company customers. Please try again.");
        setLoading(false);
        return;
      }

      // If company has customers, prevent deletion
      if (customersData && customersData.length > 0) {
        toast.error(
          "Cannot delete company. Please delete all customers of this company first, then you can delete the company.",
        );
        setLoading(false);
        return;
      }

      // Proceed with deletion if no customers exist
      const { error } = await supabase
        .from("company")
        .delete()
        .eq("id", companyToDelete.id);

      if (error) {
        console.error("Delete company error:", error);
        toast.error("Failed to delete company. Please try again.");
        return;
      }

      // Remove from local state
      setCompanies((prev) => prev.filter((c) => c.id !== companyToDelete.id));

      // Close dialog and reset
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
      toast.success("Company deleted successfully!");
    } catch (err) {
      console.error("Delete company error:", err);
      toast.error("Failed to delete company. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    resetForm();
    setOpen(true);
    setCustomerForm({
      customerFirstName: "",
      customerLastName: "",
      customerEmail: "",
      customerPhone: "",
      Customer_title: "",
      alternateEmail1: "",
      alternateEmail2: "",
    });
    setUseSameAsMain(false);
    setAccountForm({
      customerFirstName: "",
      customerLastName: "",
      customerEmail: "",
      customerPhone: "",
      Customer_title: "",
      alternateEmail1: "",
      alternateEmail2: "",
    });
    setAccountErrors({});
  };

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Fetch delivery zones when dialog opens or franchise changes (for super admin)
  useEffect(() => {
    if (open) fetchDeliveryZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.franchise_id]);

  const updateCustomer = (key: keyof typeof customerForm, value: string) => {
    setCustomerForm((prev) => ({ ...prev, [key]: value }));
    setCustomerErrors((prev) => ({ ...prev, [key]: "" }));
  };

  // validation
  const validateCustomer = () => {
    const e: Record<string, string> = {};

    if (!customerForm.customerFirstName.trim())
      e.customerFirstName = "First name required";

    if (!customerForm.customerEmail.trim()) e.customerEmail = "Email required";
    else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerForm.customerEmail.trim())
    )
      e.customerEmail = "Invalid email";

    if (!customerForm.customerPhone.trim()) e.customerPhone = "Phone required";
    else if (customerForm.customerPhone.replace(/\D/g, "").length !== 10)
      e.customerPhone = "Phone must be 10 digits";

    if (!customerForm.Customer_title.trim())
      e.Customer_title = "Customer title required";

    setCustomerErrors(e);
    return Object.keys(e).length === 0;
  };
  const isAnyCustomerFieldFilled = () => {
    return (
      customerForm.customerFirstName.trim() ||
      customerForm.customerLastName.trim() ||
      customerForm.customerEmail.trim() ||
      customerForm.customerPhone.trim()
    );
  };

  const validateCustomerIfNeeded = () => {
    // ✅ if nothing filled => no validation errors
    if (!isAnyCustomerFieldFilled()) {
      setCustomerErrors({});
      return true;
    }
    // ✅ if any field filled => full validation required
    return validateCustomer();
  };

  // password generator
  const generateCustomerPassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    return pass;
  };

  // submit
  const handleCustomerSubmit = async (company: any) => {
    // ✅ Only run if any customer field filled (otherwise skip)
    if (!isAnyCustomerFieldFilled()) return;

    // ✅ strict validation because some field is filled
    if (!validateCustomer()) return;

    if (!company?.id) {
      toast.error("Company not found. Please create company first.");
      return;
    }

    setCustomerLoading(true);

    // ✅ Save current admin session tokens BEFORE signUp
    const { data: currentSession } = await supabase.auth.getSession();
    const savedAccessToken = currentSession?.session?.access_token;
    const savedRefreshToken = currentSession?.session?.refresh_token;

    const customerEmail = customerForm.customerEmail.trim().toLowerCase();
    const customerFullName =
      `${customerForm.customerFirstName.trim()} ${customerForm.customerLastName.trim()}`.trim();
    const customerPhone = customerForm.customerPhone.replace(/\D/g, "");
    const tempPassword = generateCustomerPassword();

    const loginUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/login`
        : "http://localhost:3001/login";

    try {
      const customerPayload = {
        company_name: company.company_name,
        first_name: customerForm.customerFirstName.trim(),
        last_name: customerForm.customerLastName.trim(),
        email: customerEmail,
        phone: customerPhone,
        Customer_title: customerForm.Customer_title,
        delivery_address: company.address,
        delivery_zone: company.delivery_zone,
        delivery_zone_name: company.delivery_zone_name,

        zoneCity: null,
        created_by_email: null,
        alternateEmail1: customerForm.alternateEmail1?.trim() || null,
        alternateEmail2: customerForm.alternateEmail2?.trim() || null,
        alternatePhone: null,


        company_id: company.id,
        notes: null,
        password: tempPassword,
        status: "active",
        franchise_id: company.franchise_id,
        account_status: useSameAsMain ? true : false,
      };

      // ✅ 1) Insert into customers table
      const { data: insertedCustomer, error: insertErr } = await supabase
        .from("customers")
        .insert(customerPayload)
        .select("*")
        .single();

      if (insertErr) throw insertErr;

      // ✅ 2) Auth signUp (non-blocking)
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: customerEmail,
          password: tempPassword,
          options: {
            emailRedirectTo: loginUrl,
            data: {
              name: customerFullName,
              role: "Customer",
              is_temporary_password: true,
              company_id: company.id,
              franchise_id: company.franchise_id,
            },
          },
        });

        if (authErr)
          console.log("Auth signUp failed/skipped:", authErr.message);
        else if (authData?.user) console.log("Customer auth created");
      } catch (e) {
        console.log("Auth signUp exception:", e);
      }

      // ✅ CRITICAL: Restore admin session
      if (savedAccessToken && savedRefreshToken) {
        try {
          await supabase.auth.setSession({
            access_token: savedAccessToken,
            refresh_token: savedRefreshToken,
          });
          console.log("✅ Admin session restored");
        } catch (restoreErr) {
          console.error("Session restore error:", restoreErr);
        }
      }

      // ✅ 3) Send email (non-blocking)
      let franchiseName =
        franchises.find((f) => f.id === company.franchise_id)?.franchise_name ||
        "";
      if (!franchiseName && company.franchise_id) {
        const { data: f } = await supabase
          .from("franchises")
          .select("franchise_name")
          .eq("id", company.franchise_id)
          .maybeSingle();
        franchiseName = f?.franchise_name || "";
      }
      supabase.functions
        .invoke("clever-handler", {
          body: {
            to: customerEmail,
            name: customerFullName,
            email: customerEmail,
            password: tempPassword,
            role: "Customer",
            loginUrl,
            companyName: company.company_name,
            franchiseName: franchiseName || null,
            deliveryZoneName: company.delivery_zone_name || null,
          },
        })
        .then(({ error: fnErr }) => {
          if (fnErr) console.log("Email function error:", fnErr.message);
          else console.log("✅ Email sent");
        })
        .catch((err) => console.log("Email invoke error:", err));

      toast.success("Customer created successfully!");

      // reset customer form
      setCustomerForm({
        customerFirstName: "",
        customerLastName: "",
        customerEmail: "",
        customerPhone: "",
        Customer_title: "",
        alternateEmail1: "",
        alternateEmail2: "",
      });
      setCustomerErrors({});

      console.log("✅ Inserted customer:", insertedCustomer);
    } catch (err: any) {
      console.error(err);
      if (err?.code === "23505") toast.error("Email already exists");
      else toast.error("Failed to add customer");
    } finally {
      setCustomerLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Company Management
          </h1>
          <p className="text-gray-600">Manage all companies in the system</p>
        </div>
      </div>

      {/* Search and Filters */}
      {/* <Card>
        <CardContent className="p-4"> */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative ">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={handleAddNew}
          className="bg-[#00a1ff] hover:bg-[#0090e6]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>
      {/* </CardContent> */}
      {/* </Card> */}

      {/* Companies Table */}
      <Card>
        <div className="flex justify-evenly text-center gap-2">
          <h2 className={`text-2xl font-semibold text-gray-900 w-[50%] ${pathname === "/admin/company" ? "bg-white" : "bg-[#c6dff5]"} p-2 cursor-pointer`}>All Companies ({filteredCompanies.length})</h2>
          <h2 className="text-2xl font-semibold text-gray-900 w-[50%] bg-[#c6dff5] p-2 cursor-pointer" onClick={() => router.push("/admin/customers")}>All Customers</h2>
        </div>
        <CardContent>
          {loading && companies.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              Loading companies...
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort("company_name")}
                    >
                      <div className="flex items-center relative pr-4">
                        <span>Company Name</span>
                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                          {sortColumn === "company_name" ? (
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
                    </TableHead>
                    {/* <TableHead
                      className="cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center relative pr-4">
                        <span>Email</span>
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
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort("phone_number")}
                    >
                      <div className="flex items-center relative pr-4">
                        <span>Phone Number</span>
                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                          {sortColumn === "phone_number" ? (
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
                    </TableHead> */}
                    <TableHead
                      className="cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort("address")}
                    >
                      <div className="flex items-center relative pr-4">
                        <span>Address</span>
                        <span className="absolute right-0 inline-flex w-4 h-4 items-center justify-center flex-shrink-0">
                          {sortColumn === "address" ? (
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
                    </TableHead>

                    <TableHead>Franchise</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center relative pr-4">
                        <span>Status</span>
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
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center p-6 text-slate-500"
                      >
                        {searchTerm
                          ? "No companies found matching your search."
                          : "No companies found. Add your first company to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell
                          className={`font-medium ${company.status === "inactive" ? "text-gray-400" : ""}`}
                        >
                          {company.company_name}
                        </TableCell>
                        {/* <TableCell>
                          <a
                            href={`mailto:${company.email}`}
                            className={`${
                              company.status === "active"
                                ? "text-sky-600 hover:underline"
                                : "text-gray-400 cursor-not-allowed pointer-events-none"
                            }`}
                          >
                            {company.email}
                          </a>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`tel:${company.phone_number}`}
                            className={`${
                              company.status === "active"
                                ? "text-sky-600 hover:underline"
                                : "text-gray-400 cursor-not-allowed pointer-events-none"
                            }`}
                          >
                            {company.phone_number}
                          </a>
                        </TableCell> */}
                        <TableCell
                          className={`max-w-xs truncate ${company.status === "inactive" ? "text-gray-400" : ""}`}
                        >
                          {company.address}
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {company.franchise_name || "Super Admin"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={company.status === "active"}
                            onCheckedChange={() => handleToggleStatus(company)}
                            className={
                              company.status === "active"
                                ? "data-[state=checked]:bg-[#00a1ff]"
                                : "data-[state=unchecked]:bg-gray-300"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(company)}
                              className="text-blue-600 bg-blue-100 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(company)}
                              className="text-green-600 bg-green-100 text-green-700 hover:text-green-700 hover:bg-green-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(company)}
                              className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center px-6 py-4 border-t">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-600">
                    Showing {indexOfFirstItem + 1}–
                    {Math.min(indexOfLastItem, sortedCompanies.length)} of{" "}
                    {sortedCompanies.length}
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
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => (p < totalPages ? p + 1 : p))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {/* <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent 
          className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            // Prevent closing when clicking outside the modal
            e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            // Optionally prevent closing on Escape key as well
            // e.preventDefault() // Uncomment if you want to prevent Escape key from closing
          }}
        > */}
      {open && (
        <div className="fixed left-64 right-0 top-0 bottom-0 z-50 bg-gray-100 overflow-y-auto">
          <div className="min-h-screen bg-gray-100">
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
                  {editCompany ? "Edit Company" : "Add New Company"}
                  <p className="text-sm text-gray-500 ml-auto">
                    {editCompany
                      ? "Update company information below."
                      : "Enter the details for the new company."}
                  </p>
                </div>
              </div>
            </div>
            <div className="  mx-auto px-6 py-6">
              <div className="bg-white rounded-lg shadow-sm p-8 space-y-4">
                <h2 className="text-md font-semibold text-gray-900">
                  Company Information
                </h2>
                <div className="grid grid-cols-2 gap-4  ">
                  {isSuperAdmin && (
                    <div className="grid gap-2">
                      <Label htmlFor="franchise_id">
                        Franchise <span className="text-destructive">*</span>
                      </Label>
                      {franchises.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 px-3 rounded-md border border-gray-200 bg-gray-50">
                          No franchises added
                        </p>
                      ) : (
                        <Select
                          value={form.franchise_id || "none"}
                          onValueChange={(value) => {
                            const newFranchiseId =
                              value === "none" ? "" : value;
                            updateForm("franchise_id", newFranchiseId);
                            if (errors.franchise_id)
                              setErrors((prev) => ({
                                ...prev,
                                franchise_id: "",
                              }));
                            updateForm("delivery_zone", "");
                            updateForm("delivery_zone_name", "");
                          }}
                        >
                          <SelectTrigger
                            id="franchise_id"
                            className={
                              errors.franchise_id ? "border-destructive" : ""
                            }
                          >
                            <SelectValue placeholder="Select a franchise (required)" />
                          </SelectTrigger>
                          <SelectContent>
                            {franchises.map((franchise) => (
                              <SelectItem
                                key={franchise.id}
                                value={franchise.id}
                              >
                                {franchise.franchise_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {errors.franchise_id && (
                        <p className="text-sm text-destructive">
                          {errors.franchise_id}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="company_name">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(e) =>
                        updateForm("company_name", e.target.value)
                      }
                      placeholder="Enter company name"
                      className={errors.company_name ? "border-red-500" : ""}
                    />
                    {errors.company_name && (
                      <p className="text-sm text-red-500">
                        {errors.company_name}
                      </p>
                    )}
                  </div>

                  {/* <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        updateForm("email", e.target.value.toLowerCase())
                      }
                      placeholder="Enter email address"
                      className={`${errors.email ? "border-red-500" : ""} ${editCompany ? "bg-gray-100 cursor-not-allowed" : ""}`}
                      disabled={!!editCompany}
                    />
                  </div> */}

                  {/* <div className="grid gap-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      type="number"
                      value={form.phone_number}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10);
                        updateForm("phone_number", value);
                      }}
                      placeholder="Enter 10 digit phone number"
                      className={errors.phone_number ? "border-red-500" : ""}
                      maxLength={10}
                    />
                  </div> */}
                </div>
                <div className="grid gap-2 w-[50%]">
                  <Label htmlFor="DBA">DBA</Label>
                  <Input
                    id="DBA"
                    value={form.DBA}
                    onChange={(e) => updateForm("DBA", e.target.value)}
                    placeholder="DBA"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">
                    Address <span className="text-red-500">*</span>
                  </Label>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(value) => updateForm("address", value)}
                    className={`${errors.address ? "border-red-500 focus:ring-red-500" : ""}`}
                    placeholder="Enter company address"
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500">{errors.address}</p>
                  )}
                </div>
                <div className="flex w-full gap-2">
                  <div
                    className={`grid ${isSuperAdmin ? "grid-cols-2" : "grid-cols-1"} items-center gap-2 w-[50%]`}
                  >
                    {(!isSuperAdmin || form.franchise_id) && (
                      <div className="col-span-1">
                        <Label htmlFor="delivery_zone">Delivery Zone</Label>
                        <Select
                          value={form.delivery_zone || "none"}
                          onValueChange={(v) => {
                            const zonesToUse =
                              isSuperAdmin && form.franchise_id
                                ? deliveryZones.filter(
                                  (z) => z.franchise_id === form.franchise_id,
                                )
                                : deliveryZones;
                            const selectedZone = zonesToUse.find(
                              (z) => String(z.id) === v,
                            );
                            updateForm("delivery_zone", v === "none" ? "" : v);
                            updateForm(
                              "delivery_zone_name",
                              selectedZone?.zone_name || "",
                            );
                          }}
                        >
                          {/* <SelectTrigger id="delivery_zone" className={errors.delivery_zone ? 'border-red-500' : ''}> */}
                          <SelectTrigger id="delivery_zone">
                            <SelectValue placeholder="Select delivery zone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Don't Know yet</SelectItem>
                            {(() => {
                              const zonesToShow =
                                isSuperAdmin && form.franchise_id
                                  ? deliveryZones.filter(
                                    (z) => z.franchise_id === form.franchise_id,
                                  )
                                  : deliveryZones;
                              return zonesToShow.length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No zone added by franchise
                                </div>
                              ) : (
                                zonesToShow.map((zone) => (
                                  <SelectItem key={zone.id} value={String(zone.id)}>
                                    {zone.zone_name}
                                  </SelectItem>
                                ))
                              );
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {/* {isSuperAdmin && (
                <div className="col-span-1 pt-5">
              <Button 
                variant="default"
                size="sm"
                onClick={() => router.push('/admin/delivery-rules')}
              >
                Add Delivery Zone
              </Button>
              </div>
              )}
               {errors.delivery_zone && (
                <p className="text-sm text-red-500">{errors.delivery_zone}</p>
              )} */}
                  </div>
                </div>
                {/* Company Logo Section */}

                <div className="grid gap-2">
                  <Label htmlFor="companyLogo">Company Logo (Optional)</Label>
                  {logoPreview ? (
                    <div className="space-y-3">
                      <div className="relative inline-block">
                        <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => {
                            setLogoPreview(null);
                            updateForm("companyLogo", "");
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Click the X button to remove the logo
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center justify-center w-32 h-10 border-2 border-dashed border-gray-300 rounded-md cursor-pointer bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                        <Upload className="mr-2 h-4 w-4" />
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate file size (5MB)
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error("File size must be less than 5MB");
                                return;
                              }
                              // Create preview
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setLogoPreview(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                              updateForm("companyLogo", file);
                            }
                          }}
                          className="hidden"
                        />
                        Upload Logo
                      </label>
                      <span className="text-xs text-gray-500">
                        (PNG, JPG up to 5MB)
                      </span>
                    </div>
                  )}
                </div>
                {!editCompany && (
                  <>
                    <CustomerForm
                      customerForm={customerForm}
                      updateCustomer={updateCustomer}
                      customerErrors={customerErrors}
                      account={false}
                    />
                    <>
                      <div className="flex items-center justify-evenly bg-[#dce9f4] p-4">
                        <h2 className="text-md font-semibold text-gray-900">
                          Account Person Details
                        </h2>

                        <label className="flex items-center gap-2 text-md font-semibold text-gray-900 cursor-pointer select-none animate-bounce">
                          <input
                            type="checkbox"
                            className="h-6 w-6 accent-[#05dbfb]"
                            checked={useSameAsMain}
                            onChange={(e) => setUseSameAsMain(e.target.checked)}
                          />
                          Use same as main point of Contact
                        </label>
                      </div>

                      {!useSameAsMain && (
                        <CustomerForm
                          customerForm={accountForm}
                          updateCustomer={updateAccount}
                          customerErrors={accountErrors}
                          account={true}
                        />
                      )}
                    </>
                  </>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading || customerLoading
                      ? "Saving..."
                      : editCompany
                        ? "Update Company"
                        : "Submit"}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              company
              <strong> {companyToDelete?.company_name}</strong> from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
