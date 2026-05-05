"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  DollarSign,
  Package,
  ShoppingCart,
  Store,
  Users,
  Clock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import FranchisePage from "../franchise/page";

function MetricCard({
  title,
  value,
  icon: Icon,
  accent = "",
  iconBgColor = "",
  iconColor = "",
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
  iconBgColor?: string;
  iconColor?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={
        "border-none shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg relative overflow-hidden " +
        (accent ? `bg-gradient-to-b ${accent}` : "bg-card") +
        (onClick ? " cursor-pointer" : "")
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
          <Icon className={`h-6 w-6 ${iconColor || "text-muted-foreground"}`} />{" "}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-row items-center justify-between">
        <div className="text-3xl font-semibold tracking-tight text-gray-900">
          {value}
        </div>
        <div className={`rounded-xl p-2 ${iconBgColor || "bg-muted/40"}`}>
          <Icon className={`h-4 w-4 ${iconColor || "text-muted-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  iconColor = "blue",
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  iconColor?: "blue" | "purple";
}) {
  const iconBgClass = iconColor === "purple" ? "bg-purple-100" : "bg-blue-100";
  const iconTextClass =
    iconColor === "purple" ? "text-purple-600" : "text-blue-600";

  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          {Icon ? (
            <div className="flex items-center gap-2">
              <div className={`rounded-lg ${iconBgClass} p-1.5`}>
                <Icon className={`h-4 w-4 ${iconTextClass}`} />
              </div>
              <h2 className="text-base font-semibold tracking-wide text-gray-600">
                {title}
              </h2>
            </div>
          ) : (
            <h2 className="text-base font-semibold tracking-wide text-gray-600">
              {title}
            </h2>
          )}
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function RecentOrdersList({ orders }: { orders: any[] }) {
  const router = useRouter();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-600">
          My Recent Orders
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent orders
          </p>
        ) : (
          orders.map((o, idx) => {
            const statusLower = (
              o.deliveryStatus ||
              o.status ||
              ""
            ).toLowerCase();
            const statusDisplay = statusLower
              .split(" ")
              .map(
                (word: string) => word.charAt(0).toUpperCase() + word.slice(1),
              )
              .join(" ");

            let statusColor = "bg-gray-100 text-gray-800";
            if (statusLower === "pending") {
              statusColor = "bg-yellow-100 text-yellow-800";
            } else if (statusLower === "completed" || statusLower === "paid") {
              statusColor = "bg-green-100 text-green-800";
            } else if (statusLower === "processing") {
              statusColor = "bg-blue-100 text-blue-800";
            }

            return (
              <div
                key={o.id}
                className="
                  flex items-center justify-between rounded-xl border bg-card p-3
                  transition-all duration-300 hover:-translate-y-1 hover:shadow-md
                "
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="h-6 w-6 items-center justify-center p-0"
                  >
                    {idx + 1}
                  </Badge>
                  <div>
                    <div className="font-medium">
                      Order #{o.order_name || o.id}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.customer_name || "Customer"} – {o.quantity || 0} Cases
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={`
                        text-xs px-2 py-0.5 rounded-md inline-block font-medium ${statusColor}
                      `}
                    >
                      {statusDisplay}
                    </p>
                  </div>
                  {/* <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => router.push(`/admin/orders?orderId=${o.order_name || o.id}`)}
                  >
                    View
                  </Button> */}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
      {orders.length > 0 && (
        <div className="px-6 pb-4 pt-2 border-t flex justify-center">
          <Button
            variant="outline"
            className="w-fit mx-auto"
            onClick={() => router.push("/admin/orders")}
          >
            View All
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [franchiseName, setFranchiseName] = useState<string>("");

  // Primary Store Metrics
  const [primaryCustomers, setPrimaryCustomers] = useState(0);
  const [primaryOrders, setPrimaryOrders] = useState(0);
  const [primaryCasesThisMonth, setPrimaryCasesThisMonth] = useState(0);
  const [primaryPendingOrders, setPrimaryPendingOrders] = useState(0);

  // Franchise Overview Metrics (Super Admin only)
  const [activeFranchises, setActiveFranchises] = useState(0);
  const [franchiseCustomers, setFranchiseCustomers] = useState(0);
  const [franchiseCasesThisMonth, setFranchiseCasesThisMonth] = useState(0);
  const [franchiseTotalOrders, setFranchiseTotalOrders] = useState(0);

  // Recent Orders
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = session?.user?.email;

      if (!email) {
        router.push("/login");
        return;
      }

      // Check if user is staff
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, email, is_super_admin, franchise_id, status")
        .eq("email", email)
        .maybeSingle();

      if (!staffData) {
        // Check if user is franchise owner
        const { data: franchiseData } = await supabase
          .from("franchises")
          .select("id, franchise_name, owner_email, status")
          .eq("owner_email", email)
          .maybeSingle();

        if (franchiseData) {
          // Check if franchise is active
          if (franchiseData.status !== "active") {
            toast.error(
              "Your franchise account is inactive. Please contact administrator.",
            );
            router.push("/login");
            return;
          }
          setIsSuperAdmin(false);
          setFranchiseId(franchiseData.id);
          setFranchiseName(franchiseData.franchise_name || "");
          await fetchFranchiseData(franchiseData.id);
        } else {
          router.push("/login");
        }
        return;
      }

      if (staffData.status !== "Active") {
        toast.error("Your account is inactive. Please contact administrator.");
        router.push("/login");
        return;
      }

      const superAdmin = staffData.is_super_admin === true;
      setIsSuperAdmin(superAdmin);
      setFranchiseId(staffData.franchise_id);

      if (superAdmin) {
        await fetchSuperAdminData();
      } else if (staffData.franchise_id) {
        // Fetch franchise name
        const { data: franchiseData } = await supabase
          .from("franchises")
          .select("franchise_name")
          .eq("id", staffData.franchise_id)
          .maybeSingle();

        setFranchiseName(franchiseData?.franchise_name || "");
        await fetchFranchiseData(staffData.franchise_id);
      }
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperAdminData = async () => {
    try {
      // Get current month start and end
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      // Super Admin sees ALL data (no filter)
      const { count: primaryCustomersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      // No filter - show all customers

      const { data: primaryOrdersData } = await supabase
        .from("orders")
        .select("id, quantity, deliveryStatus, created_at");
      // No filter - show all orders

      // Calculate primary store metrics
      const primaryOrdersCount = primaryOrdersData?.length || 0;
      const primaryCases = (primaryOrdersData || []).reduce(
        (sum, o) => sum + (Number(o.quantity) || 0),
        0,
      );
      const primaryCasesThisMonth = (primaryOrdersData || [])
        .filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      const primaryPending = (primaryOrdersData || []).filter(
        (o) => (o.deliveryStatus || "").toLowerCase() === "pending",
      ).length;

      setPrimaryCustomers(primaryCustomersCount || 0);
      setPrimaryOrders(primaryOrdersCount);
      setPrimaryCasesThisMonth(primaryCasesThisMonth);
      setPrimaryPendingOrders(primaryPending);

      // All Franchises Overview
      const { data: franchisesData } = await supabase
        .from("franchises")
        .select("id, status")
        .eq("status", "active");

      const { count: franchiseCustomersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .not("franchise_id", "is", null);

      const { data: franchiseOrdersData } = await supabase
        .from("orders")
        .select("id, quantity, created_at")
        .not("franchise_id", "is", null);

      const franchiseCasesThisMonth = (franchiseOrdersData || [])
        .filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);

      setActiveFranchises(franchisesData?.length || 0);
      setFranchiseCustomers(franchiseCustomersCount || 0);
      setFranchiseCasesThisMonth(franchiseCasesThisMonth);
      setFranchiseTotalOrders(franchiseOrdersData?.length || 0);

      // Recent Orders (all orders for Super Admin)
      const { data: recentOrdersData } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_name,
          quantity,
          deliveryStatus,
          status,
          customer_id,
          customers:customer_id (
            company_name,
            first_name,
            last_name
          )
        `,
        )
        // No filter - show all recent orders
        .order("created_at", { ascending: false })
        .limit(5);

      const ordersWithCustomer = (recentOrdersData || []).map((o: any) => ({
        ...o,
        customer_name:
          o.customers?.company_name ||
          `${o.customers?.first_name || ""} ${o.customers?.last_name || ""}`.trim() ||
          "Customer",
      }));

      setRecentOrders(ordersWithCustomer);
    } catch (error) {
      console.error("Error fetching super admin data:", error);
      toast.error("Error loading dashboard data");
    }
  };

  const fetchFranchiseData = async (franchiseIdParam: string) => {
    try {
      // Get current month start and end
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      // Franchise Metrics
      const { count: franchiseCustomersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("franchise_id", franchiseIdParam);

      const { data: franchiseOrdersData } = await supabase
        .from("orders")
        .select("id, quantity, deliveryStatus, created_at")
        .eq("franchise_id", franchiseIdParam);

      const franchiseOrdersCount = (franchiseOrdersData || []).length;
      const franchiseCasesThisMonth = (franchiseOrdersData || [])
        .filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      const franchisePending = (franchiseOrdersData || []).filter(
        (o) => (o.deliveryStatus || "").toLowerCase() === "pending",
      ).length;

      setPrimaryCustomers(franchiseCustomersCount || 0);
      setPrimaryOrders(franchiseOrdersCount);
      setPrimaryCasesThisMonth(franchiseCasesThisMonth);
      setPrimaryPendingOrders(franchisePending);

      // Recent Orders (from franchise)
      const { data: recentOrdersData } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_name,
          quantity,
          deliveryStatus,
          status,
          customer_id,
          customers:customer_id (
            company_name,
            first_name,
            last_name
          )
        `,
        )
        .eq("franchise_id", franchiseIdParam)
        .order("created_at", { ascending: false })
        .limit(5);

      const ordersWithCustomer = (recentOrdersData || []).map((o: any) => ({
        ...o,
        customer_name:
          o.customers?.company_name ||
          `${o.customers?.first_name || ""} ${o.customers?.last_name || ""}`.trim() ||
          "Customer",
      }));

      setRecentOrders(ordersWithCustomer);
    } catch (error) {
      console.error("Error fetching franchise data:", error);
      toast.error("Error loading dashboard data");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Heading */}
      <Card className="bg-white border-none p-6 shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300 ease-in-out">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-sky-500">
            {isSuperAdmin ? "Super Admin Dashboard" : "Franchise Dashboard"}
          </h1>
          <p className="text-sm text-gray-500">
            Welcome back,{" "}
            <span className="font-medium text-sky-500">
              {isSuperAdmin
                ? "Super Admin"
                : franchiseName || "Franchise Owner"}
            </span>
          </p>
        </div>
      </Card>

      {/* Primary Store / Franchise Section */}
      <div className="space-y-3">
        <SectionHeader
          title={isSuperAdmin ? "Overall Statistics" : "My Franchise"}
           
          icon={Store}
          iconColor="blue"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Customers"
            value={primaryCustomers}
            icon={Users}
            accent="from-blue-50 to-blue-100"
            iconBgColor="bg-blue-200"
            iconColor="text-blue-600"
            onClick={() => router.push("/admin/customers")}
          />
          <MetricCard
            title="Total Orders"
            value={primaryOrders}
            icon={Package}
            accent="from-green-50 to-green-100"
            iconBgColor="bg-green-200"
            iconColor="text-green-600"
            onClick={() => router.push("/admin/orders")}
          />
          <MetricCard
            title="Cases Sold This Month"
            value={primaryCasesThisMonth.toLocaleString()}
            icon={Package}
            accent="from-purple-50 to-purple-100"
            iconBgColor="bg-purple-200"
            iconColor="text-purple-600"
            onClick={() => router.push("/admin/orders")}
          />
          <MetricCard
            title="Pending Orders"
            value={primaryPendingOrders}
            icon={Clock}
            accent="from-orange-50 to-orange-100"
            iconBgColor="bg-orange-200"
            iconColor="text-orange-600"
            onClick={() => router.push("/admin/orders?status=pending")}
          />
        </div>
      </div>

      {/* All Franchises Overview (Super Admin only) */}
      {/* {isSuperAdmin && (
        <div className="space-y-3">
          <SectionHeader
            title="All Franchises Overview"
            subtitle="View Only - All metrics"
            icon={MapPin}
            iconColor="purple"
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Active Franchises"
              value={activeFranchises}
              icon={Store}
              accent="from-purple-50 to-purple-100"
              iconBgColor="bg-purple-200"
              iconColor="text-purple-600"
              onClick={() => router.push('/admin/franchise')}
            />
            <MetricCard
              title="Franchises Customers"
              value={franchiseCustomers}
              icon={Users}
              accent="from-blue-50 to-blue-100"
              iconBgColor="bg-blue-200"
              iconColor="text-blue-600"
              onClick={() => router.push('/admin/customers')}
            />
            <MetricCard
              title="Total Cases Sold This Month"
              value={franchiseCasesThisMonth.toLocaleString()}
              icon={Package}
              accent="from-green-50 to-green-100"
              iconBgColor="bg-green-200"
              iconColor="text-green-600"
              onClick={() => router.push('/admin/orders')}
            />
            <MetricCard
              title="Total Orders"
              value={franchiseTotalOrders.toLocaleString()}
              icon={ShoppingCart}
              accent="from-orange-50 to-orange-100"
              iconBgColor="bg-orange-200"
              iconColor="text-orange-600"
              onClick={() => router.push('/admin/orders')}
            />
          </div>
        </div>
      )} */}

      {/* Recent Orders */}
      <div className="w-full">
        {!isSuperAdmin ? (
          <RecentOrdersList orders={recentOrders} />
        ) : (
          <FranchisePage />
        )}
      </div>
    </div>
  );
}
