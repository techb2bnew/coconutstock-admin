'use client'

import { DeliveryRulesManagement } from "@/components/DeliveryRulesManagement";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const hasCheckedRef = useRef(false);

  // Security: Block super admin from accessing delivery-rules page
  useEffect(() => {
    // Prevent multiple executions
    if (hasCheckedRef.current) return;
    
    const checkAccess = async () => {
      hasCheckedRef.current = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;

        if (!email) {
          router.push('/login');
          return;
        }

        // Check if user is staff and super admin
        const { data: staffData } = await supabase
          .from('staff')
          .select('is_super_admin, status')
          .eq('email', email)
          .maybeSingle();

        if (staffData && staffData.status === 'Active' && staffData.is_super_admin === true) {
          // Super admin - deny access
          toast.error('Access denied. Delivery Rules is not available for Super Admin.')
          router.push('/admin/dashboard');
          return;
        }

        // Allow access for franchise owners and regular staff
        setIsCheckingAccess(false);
      } catch (error) {
        console.error('Access check error:', error);
        toast.error('Error verifying access. Please try again.')
        router.push('/admin/dashboard');
      }
    };

    checkAccess();
  }, [router]);

  // Show loading while checking access
  if (isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <DeliveryRulesManagement />
}
