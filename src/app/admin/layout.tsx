"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Truck,
  ShoppingCart,
  UsersRound,
  LogOut,
  Search,
  Receipt,
  FileText,
  Send,
  ChevronRight,
  Bell,
  Building2,
  GraduationCap,
  Building,
  Image as ImageIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { UserNav } from "@/components/user-nav";
import type { ReactNode } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ensureFranchiseFcmRegistered } from "@/lib/registerFranchiseFcm";

const primaryStoreItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Company", href: "/admin/company", icon: Building },
  { title: "Customers", href: "/admin/customers", icon: Users },
  { title: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { title: "Warehouse Staff", href: "/admin/staff", icon: UsersRound },
  { title: "Delivery Rules", href: "/admin/delivery-rules", icon: Truck },
  // { title: 'Invoices', href: '/admin/invoices', icon: FileText },
  { title: "Notifications", href: "/admin/notifications", icon: Bell },
];

const franchiseItems = [
  { title: "Franchise Management", href: "/admin/franchise", icon: Building2 },
  { title: "Notifications", href: "/admin/franchise-notifications", icon: Bell },
];

const operationsItems = [
  { title: "Drivers", href: "/admin/drivers", icon: Send },
  { title: "Training Resources", href: "/admin/training", icon: GraduationCap },
  { title: "Banner", href: "/admin/banner", icon: ImageIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isFranchiseOwner, setIsFranchiseOwner] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("coconut_auth");
    localStorage.removeItem("current_franchise_id"); // Clear franchise ID on logout
    localStorage.removeItem("current_staff_email"); // Clear staff email on logout
    localStorage.removeItem("is_super_admin"); // Clear super admin flag on logout
    document.cookie = "auth-token=; path=/; max-age=0";
    router.push("/login");
  };

  // Check if user exists in database
  useEffect(() => {
    const checkUserExists = async () => {
      try {
        // Get current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user?.email) {
          await handleLogout();
          return;
        }

        const userEmail = session.user.email;

        // Check if user exists in any table (staff, customers, drivers, franchises)
        // For staff, also fetch their email, is_super_admin flag, and status to scope data by creator
        const [staffResult, customersResult, driversResult, franchiseResult] =
          await Promise.all([
            supabase
              .from("staff")
              .select("id, email, is_super_admin, status")
              .eq("email", userEmail)
              .maybeSingle(),
            supabase
              .from("customers")
              .select("id")
              .eq("email", userEmail)
              .maybeSingle(),
            supabase
              .from("drivers")
              .select("id")
              .eq("email", userEmail)
              .maybeSingle(),
            supabase
              .from("franchises")
              .select("id, status")
              .eq("owner_email", userEmail)
              .maybeSingle(),
          ]);

        // Check if user is customer or driver - block admin panel access
        if (customersResult.data) {
          // Customer can only access via mobile app, not admin panel
          console.log("Customer trying to access admin panel, logging out...");
          await handleLogout();
          return;
        }

        if (driversResult.data) {
          // Driver can only access via mobile app, not admin panel
          console.log("Driver trying to access admin panel, logging out...");
          await handleLogout();
          return;
        }

        // If user doesn't exist in any allowed table (staff or franchise), logout
        const userExists = staffResult.data || franchiseResult.data;

        // Check if staff is active (if they are staff)
        if (staffResult.data && staffResult.data.status !== "Active") {
          console.log("Staff account is inactive, logging out...");
          toast.error(
            "Your account is inactive. Please contact administrator.",
          );
          await handleLogout();
          return;
        }

        // Check if franchise is active (if they are franchise owner)
        if (franchiseResult.data && franchiseResult.data.status !== "active") {
          console.log("Franchise account is inactive, logging out...");
          toast.error(
            "Your franchise account is inactive. Please contact administrator.",
          );
          await handleLogout();
          return;
        }

        // Check if user is super admin
        const isSuperAdminValue = staffResult.data?.is_super_admin === true;
        setIsSuperAdmin(isSuperAdminValue);

        // Security: Block regular staff (non-super admin) from accessing admin panel
        if (staffResult.data && !isSuperAdminValue) {
          // Regular staff member trying to access admin panel - redirect to warehouse
          console.log(
            "Regular staff trying to access admin panel, redirecting to warehouse...",
          );
          toast.error(
            "Access denied. Staff members can only access the warehouse.",
          );
          router.push("/warehouse");
          return;
        }

        // Store identifiers for data scoping
        // Priority: super admin > franchise owner > staff member
        if (isSuperAdminValue) {
          // User is a super admin - can see all data
          localStorage.setItem("is_super_admin", "true");
          localStorage.removeItem("current_franchise_id"); // Clear franchise ID
          localStorage.removeItem("current_staff_email"); // Clear staff email
        } else if (franchiseResult.data?.id) {
          // User is a franchise owner
          localStorage.setItem("current_franchise_id", franchiseResult.data.id);
          localStorage.removeItem("current_staff_email"); // Clear staff email if franchise owner
          localStorage.removeItem("is_super_admin"); // Clear super admin flag
          setIsFranchiseOwner(true); // Set flag to hide franchise management
        } else if (staffResult.data?.email) {
          // User is a staff member - store their email to filter by creator
          localStorage.setItem("current_staff_email", staffResult.data.email);
          localStorage.removeItem("is_super_admin"); // Clear super admin flag
          // Don't remove franchise_id here - staff might belong to a franchise
          // Individual pages will handle franchise_id filtering
        } else {
          // HQ admin or other user types
          localStorage.removeItem("is_super_admin");
          setIsFranchiseOwner(false); // Not a franchise owner
        }
        // Don't remove current_staff_email or franchise_id if not found - preserve existing localStorage values
        // This prevents accidental removal during create operations or re-renders

        if (!userExists) {
          console.log("User not found in database, logging out...");
          await handleLogout();
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Error checking user existence:", error);
        setIsChecking(false);
      }
    };

    checkUserExists();

    // Also check on pathname change (when navigating between pages)
    const interval = setInterval(() => {
      checkUserExists();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (isFranchiseOwner) {
      void ensureFranchiseFcmRegistered();
    }
  }, [isFranchiseOwner]);

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="  min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col fixed left-0 top-0 h-full shadow-sm">
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-6 mt-0 p-5 bg-blue-100">
          <div className="flex items-center justify-center rounded-full overflow-hidden bg-white border-2 border-pink-200">
            <Image
              src="/assests/logos/coconut.png"
              alt="Brand"
              width={50}
              height={50}
              className="object-contain p-2"
            />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-blue-600 font-bold text-lg leading-tight">
              CoconutStock
            </p>
            <p className="text-[11px] text-gray-500 leading-none">
              Multi-Location System
            </p>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 mt-2 overflow-y-auto">
          {/* PRIMARY STORE MANAGEMENT */}
          <div className="mb-4">
            <p className="text-[12px]   text-gray-700 uppercase tracking-wider px-5 mb-2">
              PRIMARY STORE MANAGEMENT
            </p>
            {primaryStoreItems
              .filter((item) => {
                // Hide "Warehouse Staff" for super admin
                if (item.title === "Warehouse Staff" && isSuperAdmin) {
                  return false;
                }
                // Hide "Delivery Rules" for super admin
                if (item.title === "Delivery Rules" && isSuperAdmin) {
                  return false;
                }
                // Hide "Notifications" for super admin
                if (item.title === "Notifications" && isSuperAdmin) {
                  return false;
                } 
                if (item.title === "Customers") {
                  return false;
                }
                return true;
              })
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.title} href={item.href}>
                    <div
                      className={`flex items-center justify-between px-5 py-3 mx-2 rounded-md cursor-pointer transition-colors 
                        ${
                          isActive
                            ? "bg-sky-400 text-white shadow-lg"
                            : "text-black-700 hover:bg-blue-50 hover:text-sky-400"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span className="text-sm">{item.title}</span>
                      </div>
                      {isActive && (
                        <ChevronRight className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>

          {/* FRANCHISE SYSTEM - Hide for franchise owners */}
          {!isFranchiseOwner && (
            <div className="mb-4">
              <p className="text-[12px] text-gray-700 uppercase tracking-wider px-5 mb-2">
                FRANCHISE SYSTEM
              </p>
              {franchiseItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.title} href={item.href}>
                    <div
                      className={`flex items-center justify-between px-5 py-3 mx-2 rounded-md cursor-pointer transition-colors 
                        ${
                          isActive
                            ? "bg-sky-400 text-white shadow-lg"
                            : "text-black-700 hover:bg-blue-50 hover:text-sky-400"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span className="text-sm">{item.title}</span>
                      </div>
                      {isActive && (
                        <ChevronRight className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* OPERATIONS */}
          <div className="mb-4">
            <p className="text-[12px] text-gray-700 uppercase tracking-wider px-5 mb-2">
              OPERATIONS
            </p>
            {operationsItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              if (item.title === "Drivers" && isSuperAdmin) {
                return false;
              }
              if (item.title === "Banner" && !isSuperAdmin) {
                return false;
              }
              return (
                <Link key={item.title} href={item.href}>
                  <div
                    className={`flex items-center justify-between px-5 py-3 mx-2 rounded-md cursor-pointer transition-colors 
                      ${
                        isActive
                          ? "bg-sky-400 text-white shadow-lg"
                          : "text-black-700 hover:bg-blue-50 hover:text-sky-400"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span className="  text-sm">{item.title}</span>
                    </div>
                    {isActive && (
                      <ChevronRight className="h-4 w-4 text-white" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t p-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-md"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
