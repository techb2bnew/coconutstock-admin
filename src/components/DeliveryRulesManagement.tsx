"use client";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Plus, Edit, Trash2, Eye, Clock, MapPin, Package } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface DeliveryRulesManagementProps {
  locationId: string;
  locationName: string;
}

interface QuantityBasedRule {
  id: string;
  min_quantity: number;
  max_quantity: number;
  delivery_offset: number; // Days
  status: string;
}

interface ZoneBasedRule {
  id: string;
  zone_id: string;
  zone_name?: string; // From join
  cutoff_time: string | null; // Format: "HH:MM:SS" or null
  next_day_offset: number;
  after_cutoff_offset: number;
  status: string;
}

interface DeliveryZone {
  id: string;
  zone_name: string;
  description: string | null;
  status: string;
}


export function DeliveryRulesManagement() {
  // Quantity-based rules state
  const [quantityRules, setQuantityRules] = useState<QuantityBasedRule[]>([]);
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [currentQtyRule, setCurrentQtyRule] = useState<QuantityBasedRule | null>(null);
  const [qtyFormData, setQtyFormData] = useState({
    minQty: 0,
    maxQty: 0,
    deliveryOffset: 0,
    status: "Active"
  });
  const [qtyErrors, setQtyErrors] = useState<{ [key: string]: string }>({});
  const [loadingQty, setLoadingQty] = useState(false);

  // Zone-based rules state
  const [zoneRules, setZoneRules] = useState<ZoneBasedRule[]>([]);
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [currentZoneRule, setCurrentZoneRule] = useState<ZoneBasedRule | null>(null);
  const [zoneFormData, setZoneFormData] = useState({
    zoneId: "",
    cutoffTime: "",
    nextDayOffset: 1,
    afterCutoffOffset: 0,
    status: "Active"
  });
  const [zoneErrors, setZoneErrors] = useState<{ [key: string]: string }>({});
  const [loadingZone, setLoadingZone] = useState(false);

  // Delivery zones state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isDeliveryZoneDialogOpen, setIsDeliveryZoneDialogOpen] = useState(false);
  const [currentDeliveryZone, setCurrentDeliveryZone] = useState<DeliveryZone | null>(null);
  const [deliveryZoneFormData, setDeliveryZoneFormData] = useState({
    zone_name: "",
    description: "",
    status: "Active"
  });
  const [zoneFormErrors, setZoneFormErrors] = useState<{ [key: string]: string }>({});
  const [loadingZones, setLoadingZones] = useState(false);

  // Delete confirmation dialogs
  const [deleteQtyDialogOpen, setDeleteQtyDialogOpen] = useState(false);
  const [deleteZoneDialogOpen, setDeleteZoneDialogOpen] = useState(false);
  const [deleteDeliveryZoneDialogOpen, setDeleteDeliveryZoneDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'qty' | 'zone' | 'deliveryZone', id: string, name?: string } | null>(null);
  const [franchiseId, setFranchiseId] = useState<string | null | undefined>(undefined);

  // Fetch data from Supabase
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
          console.error('Franchise lookup error (delivery rules):', error);
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
        console.error('Franchise resolve error (delivery rules):', err);
        setFranchiseId(null);
      }
    };

    void resolveFranchise();
  }, []);

  useEffect(() => {
    if (franchiseId === undefined) return;
    fetchDeliveryZones();
    fetchQuantityRules();
    fetchZoneRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchiseId]);

  const fetchDeliveryZones = async () => {
    setLoadingZones(true);
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      // Don't rely on state as it might be stale after create
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      let query = supabase.from('delivery_zones').select('*').order('created_at', { ascending: false });
      
      // Filter based on user role:
      // Super Admin: Show only delivery zones where franchise_id IS NULL (their own data)
      // Franchise: Show only delivery zones where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only their own data (franchise_id IS NULL)
        query = query.is('franchise_id', null);
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        query = query.eq('franchise_id', currentFranchiseId);
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        query = query.eq('created_by_email', currentStaffEmail);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        query = query.eq('id', '-1'); // Impossible condition
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching delivery zones:', error);
        toast.error('Error loading delivery zones');
      } else {
        setDeliveryZones(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingZones(false);
    }
  };

  const fetchQuantityRules = async () => {
    setLoadingQty(true);
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      // Don't rely on state as it might be stale after create
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      let query = supabase.from('quantity_delivery_rules').select('*').order('created_at', { ascending: false });
      
      // Filter based on user role:
      // Super Admin: Show only quantity rules where franchise_id IS NULL (their own data)
      // Franchise: Show only quantity rules where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only their own data (franchise_id IS NULL)
        query = query.is('franchise_id', null);
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        query = query.eq('franchise_id', currentFranchiseId);
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        query = query.eq('created_by_email', currentStaffEmail);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        query = query.eq('id', '-1'); // Impossible condition
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching quantity rules:', error);
        toast.error('Error loading quantity rules');
      } else {
        setQuantityRules(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingQty(false);
    }
  };

  const fetchZoneRules = async () => {
    setLoadingZone(true);
    try {
      // Always read from localStorage (source of truth set by AdminLayout)
      // Don't rely on state as it might be stale after create
      const currentFranchiseId = typeof window !== 'undefined' 
        ? localStorage.getItem('current_franchise_id') 
        : null

      const isSuperAdmin = typeof window !== 'undefined' 
        ? localStorage.getItem('is_super_admin') === 'true'
        : false
      const currentStaffEmail = typeof window !== 'undefined' 
        ? localStorage.getItem('current_staff_email') 
        : null

      let query = supabase
        .from('zone_delivery_rules')
        .select(`
          *,
          delivery_zones!zone_delivery_rules_zone_id_fkey (
            zone_name
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role:
      // Super Admin: Show only zone rules where franchise_id IS NULL (their own data)
      // Franchise: Show only zone rules where franchise_id = their franchise_id
      if (isSuperAdmin) {
        // Super admin sees only their own data (franchise_id IS NULL)
        query = query.is('franchise_id', null);
      } else if (currentFranchiseId) {
        // Franchise sees only their own data
        query = query.eq('franchise_id', currentFranchiseId);
      } else if (currentStaffEmail) {
        // Staff member (not franchise owner): filter by creator
        query = query.eq('created_by_email', currentStaffEmail);
      } else {
        // If no franchise_id found, show empty (shouldn't happen but safety check)
        query = query.eq('id', '-1'); // Impossible condition
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching zone rules:', error);
        toast.error('Error loading zone rules');
      } else {
        const formattedData = (data || []).map(rule => ({
          ...rule,
          zone_name: rule.delivery_zones?.zone_name || ''
        }));
        setZoneRules(formattedData);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingZone(false);
    }
  };

  const formatTimeDisplay = (time24: string | null) => {
    if (!time24) return 'Not set';
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const validateQtyForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    if (!qtyFormData.minQty || qtyFormData.minQty < 0) {
      errors.minQty = "Minimum quantity is required and must be 0 or greater";
    }
    
    if (!qtyFormData.maxQty || qtyFormData.maxQty < 0) {
      errors.maxQty = "Maximum quantity is required and must be 0 or greater";
    }
    
    if (qtyFormData.minQty >= qtyFormData.maxQty) {
      errors.maxQty = "Maximum quantity must be greater than minimum quantity";
    }
    
    if (qtyFormData.deliveryOffset === undefined || qtyFormData.deliveryOffset < 0 || qtyFormData.deliveryOffset > 2) {
      errors.deliveryOffset = "Delivery offset must be Same Day, 1 day, or 2 day";
    }
    
    setQtyErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveQuantityRule = async () => {
    if (!validateQtyForm()) {
      return;
    }

    try {
      if (currentQtyRule) {
        // Edit mode
        const { error } = await supabase
          .from('quantity_delivery_rules')
          .update({
            min_quantity: qtyFormData.minQty,
            max_quantity: qtyFormData.maxQty,
            delivery_offset: qtyFormData.deliveryOffset,
            status: qtyFormData.status
          })
          .eq('id', currentQtyRule.id);

        if (error) {
          console.error('Error updating quantity rule:', error);
          toast.error('Error updating quantity rule', {
            description: error.message
          });
          return;
        }

        toast.success("Quantity-based delivery rule updated!", {
          description: `Rule for ${qtyFormData.minQty}-${qtyFormData.maxQty} units has been updated.`,
          duration: 3000,
        });
      } else {
        // Add mode - Check if zone rules exist (mutual exclusivity)
        const activeZoneRules = zoneRules.filter(rule => rule.status === 'Active');
        if (activeZoneRules.length > 0) {
          toast.error('Cannot add quantity-based rule', {
            description: 'Zone-based rules already exist. Please delete all zone-based rules before adding quantity-based rules.'
          });
          return;
        }

        // Add mode
        // Always read from localStorage (source of truth set by AdminLayout)
        let currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id')?.trim() || null
          : null

        // Validate franchise_id exists in franchises table if not null
        if (currentFranchiseId) {
          console.log('Validating franchise_id:', currentFranchiseId)
          const { data: franchiseCheck, error: franchiseError } = await supabase
            .from('franchises')
            .select('id')
            .eq('id', currentFranchiseId)
            .maybeSingle()

          if (franchiseError) {
            console.error('Error checking franchise:', franchiseError)
            toast.error('Error validating franchise', {
              description: franchiseError.message
            })
            return
          }

          if (!franchiseCheck) {
            console.warn('Franchise ID not found in franchises table, setting to null:', currentFranchiseId)
            toast.warning('Franchise not found', {
              description: 'Your franchise ID is invalid. Creating rule without franchise association.'
            })
            currentFranchiseId = null
          } else {
            console.log('Franchise validated successfully:', franchiseCheck.id)
          }
        }

        console.log('Inserting quantity rule with franchise_id:', currentFranchiseId || null)
        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email') 
          : null

        const { data, error } = await supabase
          .from('quantity_delivery_rules')
          .insert([{
            min_quantity: qtyFormData.minQty,
            max_quantity: qtyFormData.maxQty,
            delivery_offset: qtyFormData.deliveryOffset,
            status: qtyFormData.status,
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])
          .select()
          .single();

        if (error) {
          console.error('Error adding quantity rule:', error);
          
          // Handle foreign key constraint violation
          if (error.code === '23503') {
            toast.error('Invalid franchise ID', {
              description: 'The franchise ID does not exist in the franchises table. Please contact support or try again.'
            });
          } else {
            toast.error('Error adding quantity rule', {
              description: error.message
            });
          }
          return;
        }

        toast.success("Quantity-based delivery rule added!", {
          description: `Rule for ${qtyFormData.minQty}-${qtyFormData.maxQty} units has been created.`,
          duration: 3000,
        });
      }

      setIsQtyDialogOpen(false);
      setCurrentQtyRule(null);
      resetQtyForm();
      await fetchQuantityRules();
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error saving quantity rule');
    }
  };

  const handleDeleteQuantityRule = (id: string) => {
    const rule = quantityRules.find(r => r.id === id);
    setItemToDelete({ type: 'qty', id, name: `${rule?.min_quantity}-${rule?.max_quantity} units` });
    setDeleteQtyDialogOpen(true);
  };

  const confirmDeleteQtyRule = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('quantity_delivery_rules')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) {
        console.error('Error deleting quantity rule:', error);
        toast.error('Error deleting quantity rule', {
          description: error.message
        });
        return;
      }

      await fetchQuantityRules();
      toast.success("Quantity-based delivery rule deleted!", {
        description: `Rule for ${itemToDelete.name} has been removed.`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error deleting quantity rule');
    } finally {
      setDeleteQtyDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const openQuantityDialog = (rule?: QuantityBasedRule) => {
    if (rule) {
      setCurrentQtyRule(rule);
      setQtyFormData({
        minQty: rule.min_quantity,
        maxQty: rule.max_quantity,
        deliveryOffset: rule.delivery_offset,
        status: rule.status
      });
    } else {
      setCurrentQtyRule(null);
      resetQtyForm();
    }
    setQtyErrors({});
    setIsQtyDialogOpen(true);
  };

  const resetQtyForm = () => {
    setQtyFormData({
      minQty: 0,
      maxQty: 0,
      deliveryOffset: 0,
      status: "Active"
    });
    setQtyErrors({});
  };

  const validateZoneForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    if (!zoneFormData.zoneId) {
      errors.zoneId = "Zone is required";
    }
    
    if (!zoneFormData.cutoffTime) {
      errors.cutoffTime = "Cutoff time is required";
    }
    
    if (zoneFormData.nextDayOffset === undefined || zoneFormData.nextDayOffset < 0 || zoneFormData.nextDayOffset > 2) {
      errors.nextDayOffset = "Next day offset must be Same Day, 1 day, or 2 day";
    }
    
    if (zoneFormData.afterCutoffOffset === undefined || zoneFormData.afterCutoffOffset < 0 || zoneFormData.afterCutoffOffset > 2) {
      errors.afterCutoffOffset = "After cutoff offset must be Same Day, 1 day, or 2 day";
    }
    
    setZoneErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveZoneRule = async () => {
    if (!validateZoneForm()) {
      return;
    }

    try {
      const selectedZone = deliveryZones.find(z => z.id === zoneFormData.zoneId);

      if (currentZoneRule) {
        // Edit mode
        const { error } = await supabase
          .from('zone_delivery_rules')
          .update({
            zone_id: zoneFormData.zoneId,
            cutoff_time: zoneFormData.cutoffTime,
            next_day_offset: zoneFormData.nextDayOffset,
            after_cutoff_offset: zoneFormData.afterCutoffOffset,
            status: zoneFormData.status
          })
          .eq('id', currentZoneRule.id);

        if (error) {
          console.error('Error updating zone rule:', error);
          toast.error('Error updating zone rule', {
            description: error.message
          });
          return;
        }

        toast.success("Zone-based delivery rule updated!", {
          description: `Rule for ${selectedZone?.zone_name} has been updated.`,
          duration: 3000,
        });
      } else {
        // Add mode - Check if quantity rules exist (mutual exclusivity)
        const activeQuantityRules = quantityRules.filter(rule => rule.status === 'Active');
        if (activeQuantityRules.length > 0) {
          toast.error('Cannot add zone-based rule', {
            description: 'Quantity-based rules already exist. Please delete all quantity-based rules before adding zone-based rules.'
          });
          return;
        }

        // Add mode
        // Always read from localStorage (source of truth set by AdminLayout)
        let currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id')?.trim() || null
          : null

        // Validate franchise_id exists in franchises table if not null
        if (currentFranchiseId) {
          const { data: franchiseCheck, error: franchiseError } = await supabase
            .from('franchises')
            .select('id')
            .eq('id', currentFranchiseId)
            .maybeSingle()

          if (franchiseError) {
            console.error('Error checking franchise:', franchiseError)
            toast.error('Error validating franchise', {
              description: franchiseError.message
            })
            return
          }

          if (!franchiseCheck) {
            console.warn('Franchise ID not found in franchises table, setting to null:', currentFranchiseId)
            currentFranchiseId = null
          }
        }

        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email') 
          : null

        const { data, error } = await supabase
          .from('zone_delivery_rules')
          .insert([{
            zone_id: zoneFormData.zoneId,
            cutoff_time: zoneFormData.cutoffTime,
            next_day_offset: zoneFormData.nextDayOffset,
            after_cutoff_offset: zoneFormData.afterCutoffOffset,
            status: zoneFormData.status,
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])
          .select()
          .single();

        if (error) {
          console.error('Error adding zone rule:', error);
          
          // Handle foreign key constraint violation
          if (error.code === '23503') {
            toast.error('Invalid franchise ID', {
              description: 'The franchise ID does not exist in the franchises table. Please contact support or try again.'
            });
          } else {
            toast.error('Error adding zone rule', {
              description: error.message
            });
          }
          return;
        }

        toast.success("Zone-based delivery rule added!", {
          description: `Rule for ${selectedZone?.zone_name} has been created.`,
          duration: 3000,
        });
      }

      setIsZoneDialogOpen(false);
      setCurrentZoneRule(null);
      resetZoneForm();
      await fetchZoneRules();
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error saving zone rule');
    }
  };

  const handleDeleteZoneRule = (id: string) => {
    const rule = zoneRules.find(r => r.id === id);
    setItemToDelete({ type: 'zone', id, name: rule?.zone_name || 'this zone rule' });
    setDeleteZoneDialogOpen(true);
  };

  const confirmDeleteZoneRule = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('zone_delivery_rules')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) {
        console.error('Error deleting zone rule:', error);
        toast.error('Error deleting zone rule', {
          description: error.message
        });
        return;
      }

      await fetchZoneRules();
      toast.success("Zone-based delivery rule deleted!", {
        description: `Rule for ${itemToDelete.name} has been removed.`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error deleting zone rule');
    } finally {
      setDeleteZoneDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const openZoneDialog = (rule?: ZoneBasedRule) => {
    if (rule) {
      setCurrentZoneRule(rule);
      setZoneFormData({
        zoneId: rule.zone_id,
        cutoffTime: rule.cutoff_time ? rule.cutoff_time.slice(0, 5) : "",
        nextDayOffset: rule.next_day_offset,
        afterCutoffOffset: rule.after_cutoff_offset,
        status: rule.status
      });
    } else {
      setCurrentZoneRule(null);
      resetZoneForm();
    }
    setZoneErrors({});
    setIsZoneDialogOpen(true);
  };

  const resetZoneForm = () => {
    setZoneFormData({
      zoneId: "",
      cutoffTime: "",
      nextDayOffset: 1,
      afterCutoffOffset: 0,
      status: "Active"
    });
    setZoneErrors({});
  };

  // Delivery Zone Management Handlers
  const validateDeliveryZoneForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    if (!deliveryZoneFormData.zone_name || deliveryZoneFormData.zone_name.trim() === '') {
      errors.zone_name = "Zone name is required";
    }
    
    setZoneFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDeliveryZone = async () => {
    if (!validateDeliveryZoneForm()) {
      return;
    }

    try {
      if (currentDeliveryZone) {
        // Edit mode
        const { error } = await supabase
          .from('delivery_zones')
          .update({
            zone_name: deliveryZoneFormData.zone_name,
            description: deliveryZoneFormData.description || null,
            status: deliveryZoneFormData.status
          })
          .eq('id', currentDeliveryZone.id);

        if (error) {
          console.error('Error updating delivery zone:', error);
          toast.error('Error updating delivery zone', {
            description: error.message
          });
          return;
        }

        toast.success("Delivery zone updated!", {
          description: `${deliveryZoneFormData.zone_name} has been updated.`,
          duration: 3000,
        });
      } else {
        // Add mode
        // Always read from localStorage (source of truth set by AdminLayout)
        let currentFranchiseId = typeof window !== 'undefined' 
          ? localStorage.getItem('current_franchise_id')?.trim() || null
          : null

        // Validate franchise_id exists in franchises table if not null
        if (currentFranchiseId) {
          const { data: franchiseCheck, error: franchiseError } = await supabase
            .from('franchises')
            .select('id')
            .eq('id', currentFranchiseId)
            .maybeSingle()

          if (franchiseError) {
            console.error('Error checking franchise:', franchiseError)
            toast.error('Error validating franchise', {
              description: franchiseError.message
            })
            return
          }

          if (!franchiseCheck) {
            console.warn('Franchise ID not found in franchises table, setting to null:', currentFranchiseId)
            currentFranchiseId = null
          }
        }

        const isSuperAdmin = typeof window !== 'undefined' 
          ? localStorage.getItem('is_super_admin') === 'true'
          : false
        const currentStaffEmail = typeof window !== 'undefined' 
          ? localStorage.getItem('current_staff_email') 
          : null

        const { data, error } = await supabase
          .from('delivery_zones')
          .insert([{
            zone_name: deliveryZoneFormData.zone_name,
            description: deliveryZoneFormData.description || null,
            status: deliveryZoneFormData.status,
            franchise_id: isSuperAdmin ? null : (currentFranchiseId || null),
            created_by_email: isSuperAdmin ? null : (currentStaffEmail || null),
          }])
          .select()
          .single();

        if (error) {
          console.error('Error adding delivery zone:', error);
          
          // Handle foreign key constraint violation
          if (error.code === '23503') {
            toast.error('Invalid franchise ID', {
              description: 'The franchise ID does not exist in the franchises table. Please contact support or try again.'
            });
          } else {
            toast.error('Error adding delivery zone', {
              description: error.message
            });
          }
          return;
        }

        toast.success("Delivery zone added!", {
          description: `${deliveryZoneFormData.zone_name} has been created.`,
          duration: 3000,
        });
      }

      setIsDeliveryZoneDialogOpen(false);
      setCurrentDeliveryZone(null);
      resetDeliveryZoneForm();
      await fetchDeliveryZones();
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error saving delivery zone');
    }
  };

  const handleDeleteDeliveryZone = (id: string) => {
    const zone = deliveryZones.find(z => z.id === id);
    setItemToDelete({ type: 'deliveryZone', id, name: zone?.zone_name || 'this zone' });
    setDeleteDeliveryZoneDialogOpen(true);
  };

  const confirmDeleteDeliveryZone = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) {
        console.error('Error deleting delivery zone:', error);
        toast.error('Error deleting delivery zone', {
          description: error.message
        });
        return;
      }

      await fetchDeliveryZones();
      await fetchZoneRules(); // Refresh zone rules as they might be deleted via cascade
      toast.success("Delivery zone deleted!", {
        description: `${itemToDelete.name} has been removed.`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Error deleting delivery zone');
    } finally {
      setDeleteDeliveryZoneDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const openDeliveryZoneDialog = (zone?: DeliveryZone) => {
    if (zone) {
      setCurrentDeliveryZone(zone);
      setDeliveryZoneFormData({
        zone_name: zone.zone_name,
        description: zone.description || "",
        status: zone.status
      });
    } else {
      setCurrentDeliveryZone(null);
      resetDeliveryZoneForm();
    }
    setZoneFormErrors({});
    setIsDeliveryZoneDialogOpen(true);
  };

  const resetDeliveryZoneForm = () => {
    setDeliveryZoneFormData({
      zone_name: "",
      description: "",
      status: "Active"
    });
    setZoneFormErrors({});
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl mb-2">Delivery Rules</h1>
        {/* <p className="text-slate-600">{locationName}</p> */}
      </div>

      {/* Add Rule Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          Configure delivery date calculation rules based on order quantity and customer zones
        </p>
        <div className="flex gap-2">
          <Button 
            onClick={() => openQuantityDialog()} 
            disabled={zoneRules.filter(r => r.status === 'Active').length > 0}
            className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            title={zoneRules.filter(r => r.status === 'Active').length > 0 ? 'Cannot add quantity rule: Zone-based rules exist. Delete all zone rules first.' : ''}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quantity Rule
          </Button>
          <Button 
            onClick={() => openZoneDialog()} 
            disabled={quantityRules.filter(r => r.status === 'Active').length > 0}
            className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            title={quantityRules.filter(r => r.status === 'Active').length > 0 ? 'Cannot add zone rule: Quantity-based rules exist. Delete all quantity rules first.' : ''}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Zone Rule
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-sky-50 border-sky-200">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Package className="w-5 h-5 text-sky-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm">
                  <strong>Quantity-based Rules:</strong> Define delivery times based on order quantity.
                </p>
                <p className="text-xs text-slate-600">
                  Example: 1-100 cases = next day; 101-200 cases = 2 days later; 201-300 cases = 3 days later.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-sky-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm">
                  <strong>Zone-based Rules:</strong> Define delivery times based on customer zone and order cutoff time.
                </p>
                <p className="text-xs text-slate-600">
                  Example: If Zone A has a 2:00 PM cutoff, orders before 2 PM get next-day delivery, orders after 2 PM get day-after-tomorrow delivery.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-sky-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm">
                  <strong>Delivery Zones:</strong> Add/Update Delivery Zones From Here.
                </p>
                {/* <p className="text-xs text-slate-600">
                  Example: Zone A - Miami Beach ($5.00), Zone B - Downtown ($7.50), Zone C - Suburbs ($10.00).
                </p> */}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Tabs defaultValue="quantity">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quantity">Quantity-based Rules</TabsTrigger>
          <TabsTrigger value="zone">Zone-based Rules</TabsTrigger>
          <TabsTrigger value="delivery-zones">Delivery Zones</TabsTrigger>
        </TabsList>
        <TabsContent value="quantity">
          <div className="grid gap-4">
            {quantityRules.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-lg font-medium text-slate-600 mb-2">No Quantity Rules Found</p>
                  <p className="text-sm text-slate-500 mb-4">
                    Get started by creating your first quantity-based delivery rule.
                  </p>
                  <Button 
                    onClick={() => openQuantityDialog()}
                    disabled={zoneRules.filter(r => r.status === 'Active').length > 0}
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                    title={zoneRules.filter(r => r.status === 'Active').length > 0 ? 'Cannot add quantity rule: Zone-based rules exist. Delete all zone rules first.' : ''}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Quantity Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              quantityRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">
                          Quantity-based
                        </Badge>
                        <Badge variant={rule.status === "Active" ? "default" : "outline"}>
                          {rule.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Quantity Range
                          </div>
                          <div className="text-lg">{rule.min_quantity}-{rule.max_quantity} Cases</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Delivery Offset</div>
                          <div className="text-lg">
                            {rule.delivery_offset === 0 ? 'Same Day' : rule.delivery_offset === 1 ? '1 day' : rule.delivery_offset === 2 ? '2 day' : `${rule.delivery_offset} days`}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Status</div>
                          <div className="text-sm mt-1">
                            {rule.status === "Active" ? (
                              <span className="text-green-600">● Active</span>
                            ) : (
                              <span className="text-slate-400">● Inactive</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Timeline */}
                      <div className="pt-3 border-t">
                          <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-xs text-blue-700 mb-1">Delivery Time</div>
                          <div className="text-sm">
                            Orders within this range will be delivered <strong>
                              {rule.delivery_offset === 0 ? 'Same Day' : rule.delivery_offset === 1 ? 'in 1 day' : rule.delivery_offset === 2 ? 'in 2 day' : `in ${rule.delivery_offset} days`}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openQuantityDialog(rule)}
                        className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteQuantityRule(rule.id)}
                        className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="zone">
          <div className="grid gap-4">
            {zoneRules.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-lg font-medium text-slate-600 mb-2">No Zone Rules Found</p>
                  <p className="text-sm text-slate-500 mb-4">
                    Get started by creating your first zone-based delivery rule.
                  </p>
                  <Button 
                    onClick={() => openZoneDialog()} 
                    disabled={quantityRules.filter(r => r.status === 'Active').length > 0}
                    className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    title={quantityRules.filter(r => r.status === 'Active').length > 0 ? 'Cannot add zone rule: Quantity-based rules exist. Delete all quantity rules first.' : ''}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Zone Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              zoneRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">
                          Zone-based
                        </Badge>
                        <Badge variant={rule.status === "Active" ? "default" : "outline"}>
                          {rule.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Zone Name
                          </div>
                          <div className="text-lg">{rule.zone_name || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Cutoff Time
                          </div>
                          <div className="text-lg">{rule.cutoff_time ? formatTimeDisplay(rule.cutoff_time) : 'Not set'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Status</div>
                          <div className="text-sm mt-1">
                            {rule.status === "Active" ? (
                              <span className="text-green-600">● Active</span>
                            ) : (
                              <span className="text-slate-400">● Inactive</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Timeline */}
                      <div className="pt-3 border-t grid grid-cols-2 gap-4">
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-xs text-green-700 mb-1">Before {rule.cutoff_time ? formatTimeDisplay(rule.cutoff_time) : 'N/A'}</div>
                          <div className="text-sm">
                            Delivery <strong>
                              {rule.next_day_offset === 0 ? 'Same Day' : rule.next_day_offset === 1 ? 'in 1 day' : rule.next_day_offset === 2 ? 'in 2 day' : `in ${rule.next_day_offset} days`}
                            </strong>
                          </div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <div className="text-xs text-orange-700 mb-1">After {rule.cutoff_time ? formatTimeDisplay(rule.cutoff_time) : 'N/A'}</div>
                          <div className="text-sm">
                            Delivery <strong>
                              {rule.after_cutoff_offset === 0 ? 'Same Day' : rule.after_cutoff_offset === 1 ? 'in 1 day' : rule.after_cutoff_offset === 2 ? 'in 2 day' : `in ${rule.after_cutoff_offset} days`}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openZoneDialog(rule)}
                        className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteZoneRule(rule.id)}
                        className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="delivery-zones">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-600">
                Manage delivery zones and their associated fees
              </p>
              <Button className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold" onClick={() => openDeliveryZoneDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Delivery Zone
              </Button>
            </div>
            <div className="grid gap-4">
              {deliveryZones.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MapPin className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-lg font-medium text-slate-600 mb-2">No Delivery Zones Found</p>
                    <p className="text-sm text-slate-500 mb-4">
                      Get started by creating your first delivery zone.
                    </p>
                    <Button className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold" onClick={() => openDeliveryZoneDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Delivery Zone
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                deliveryZones.map((zone) => (
                <Card key={zone.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            Delivery Zone
                          </Badge>
                          <Badge variant={zone.status === "Active" ? "default" : "outline"}>
                            {zone.status}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Zone Name
                          </div>
                          <div className="text-lg">{zone.zone_name}</div>
                        </div>

                        {zone.description && (
                          <div className="pt-3 border-t">
                            <div className="text-xs text-slate-500 mb-1">Description</div>
                            <div className="text-sm text-slate-700">{zone.description}</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openDeliveryZoneDialog(zone)}
                          className="text-green-600 bg-green-100 hover:text-green-700 hover:bg-green-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteDeliveryZone(zone.id)}
                          className="text-red-600 bg-red-100 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Max Daily Amount */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Maximum Daily Amount Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-2">
                Orders exceeding this amount will be pushed to the following day
              </p>
              <div className="flex items-center gap-2">
                <span>Max Daily Amount:</span>
                <input
                  type="number"
                  defaultValue="500"
                  className="border rounded px-3 py-1 w-32"
                />
                <span>units</span>
              </div>
            </div>
            <Button>Update</Button>
          </div>
        </CardContent>
      </Card> */}

      {/* Quantity Rule Dialog (Add/Edit) */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentQtyRule ? 'Edit Quantity-based Delivery Rule' : 'Add Quantity-based Delivery Rule'}
            </DialogTitle>
            <DialogDescription>
              {currentQtyRule ? 'Update the delivery rule based on quantity range.' : 'Configure a new delivery rule based on quantity range.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="minQty">Minimum Quantity <span className="text-red-500">*</span></Label>
              <Input
                id="minQty"
                type="number"
                min="0"
                placeholder="Enter minimum quantity"
                value={qtyFormData.minQty === 0 ? '' : qtyFormData.minQty}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                  setQtyFormData({ ...qtyFormData, minQty: value });
                  if (qtyErrors.minQty) setQtyErrors({ ...qtyErrors, minQty: '' });
                }}
              />
              {qtyErrors.minQty && <p className="text-sm text-red-500">{qtyErrors.minQty}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxQty">Maximum Quantity <span className="text-red-500">*</span></Label>
              <Input
                id="maxQty"
                type="number"
                min="0"
                placeholder="Enter maximum quantity"
                value={qtyFormData.maxQty === 0 ? '' : qtyFormData.maxQty}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                  setQtyFormData({ ...qtyFormData, maxQty: value });
                  if (qtyErrors.maxQty) setQtyErrors({ ...qtyErrors, maxQty: '' });
                }}
              />
              {qtyErrors.maxQty && <p className="text-sm text-red-500">{qtyErrors.maxQty}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryOffset">Delivery Offset <span className="text-red-500">*</span></Label>
              <Select
                value={qtyFormData.deliveryOffset.toString()}
                onValueChange={(value) => {
                  setQtyFormData({ ...qtyFormData, deliveryOffset: parseInt(value) });
                  if (qtyErrors.deliveryOffset) setQtyErrors({ ...qtyErrors, deliveryOffset: '' });
                }}
              >
                <SelectTrigger id="deliveryOffset">
                  <SelectValue placeholder="Select a day offset">
                    {qtyFormData.deliveryOffset === 0 ? 'Same Day' : qtyFormData.deliveryOffset === 1 ? '1 day' : qtyFormData.deliveryOffset === 2 ? '2 day' : qtyFormData.deliveryOffset}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Same Day</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 day</SelectItem>
                </SelectContent>
              </Select>
              {qtyErrors.deliveryOffset && <p className="text-sm text-red-500">{qtyErrors.deliveryOffset}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={qtyFormData.status}
                onValueChange={(value) => setQtyFormData({ ...qtyFormData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select a status">
                    {qtyFormData.status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsQtyDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold" onClick={handleSaveQuantityRule}>
              {currentQtyRule ? 'Update Rule' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zone Rule Dialog (Add/Edit) */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentZoneRule ? 'Edit Zone-based Delivery Rule' : 'Add Zone-based Delivery Rule'}
            </DialogTitle>
            <DialogDescription>
              {currentZoneRule ? 'Update the delivery rule for a specific zone.' : 'Configure a new delivery rule for a specific zone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zoneId">Zone Name <span className="text-red-500">*</span></Label>
              <Select
                value={zoneFormData.zoneId}
                onValueChange={(value) => {
                  setZoneFormData({ ...zoneFormData, zoneId: value });
                  if (zoneErrors.zoneId) setZoneErrors({ ...zoneErrors, zoneId: '' });
                }}
              >
                <SelectTrigger id="zoneId">
                  <SelectValue placeholder="Select a zone">
                    {deliveryZones.find(z => z.id === zoneFormData.zoneId)?.zone_name || 'Select a zone'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {deliveryZones.filter(z => z.status === 'Active').map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {zoneErrors.zoneId && <p className="text-sm text-red-500">{zoneErrors.zoneId}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cutoffTime">Cutoff Time <span className="text-red-500">*</span></Label>
              <Input
                id="cutoffTime"
                type="time"
                value={zoneFormData.cutoffTime}
                onChange={(e) => {
                  setZoneFormData({ ...zoneFormData, cutoffTime: e.target.value });
                  if (zoneErrors.cutoffTime) setZoneErrors({ ...zoneErrors, cutoffTime: '' });
                }}
              />
              {zoneErrors.cutoffTime && <p className="text-sm text-red-500">{zoneErrors.cutoffTime}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDayOffset">Before cutoff offset <span className="text-red-500">*</span></Label>
              <Select
                value={zoneFormData.nextDayOffset.toString()}
                onValueChange={(value) => {
                  setZoneFormData({ ...zoneFormData, nextDayOffset: parseInt(value) });
                  if (zoneErrors.nextDayOffset) setZoneErrors({ ...zoneErrors, nextDayOffset: '' });
                }}
              >
                <SelectTrigger id="nextDayOffset">
                  <SelectValue placeholder="Select a day offset">
                    {zoneFormData.nextDayOffset === 0 ? 'Same Day' : zoneFormData.nextDayOffset === 1 ? '1 day' : zoneFormData.nextDayOffset === 2 ? '2 day' : zoneFormData.nextDayOffset}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Same Day</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 day</SelectItem>
                </SelectContent>
              </Select>
              {zoneErrors.nextDayOffset && <p className="text-sm text-red-500">{zoneErrors.nextDayOffset}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="afterCutoffOffset">After Cutoff Offset <span className="text-red-500">*</span></Label>
              <Select
                value={zoneFormData.afterCutoffOffset.toString()}
                onValueChange={(value) => {
                  setZoneFormData({ ...zoneFormData, afterCutoffOffset: parseInt(value) });
                  if (zoneErrors.afterCutoffOffset) setZoneErrors({ ...zoneErrors, afterCutoffOffset: '' });
                }}
              >
                <SelectTrigger id="afterCutoffOffset">
                  <SelectValue placeholder="Select a day offset">
                    {zoneFormData.afterCutoffOffset === 0 ? 'Same Day' : zoneFormData.afterCutoffOffset === 1 ? '1 day' : zoneFormData.afterCutoffOffset === 2 ? '2 day' : zoneFormData.afterCutoffOffset}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Same Day</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 day</SelectItem>
                </SelectContent>
              </Select>
              {zoneErrors.afterCutoffOffset && <p className="text-sm text-red-500">{zoneErrors.afterCutoffOffset}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={zoneFormData.status}
                onValueChange={(value) => setZoneFormData({ ...zoneFormData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select a status">
                    {zoneFormData.status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsZoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveZoneRule} className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold">
              {currentZoneRule ? 'Update Rule' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Zone Dialog (Add/Edit) */}
      <Dialog open={isDeliveryZoneDialogOpen} onOpenChange={setIsDeliveryZoneDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentDeliveryZone ? 'Edit Delivery Zone' : 'Add Delivery Zone'}
            </DialogTitle>
            <DialogDescription>
              {currentDeliveryZone ? 'Update the delivery zone information.' : 'Create a new delivery zone with a name and description.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zoneName">Zone Name <span className="text-red-500">*</span></Label>
              <Input
                id="zoneName"
                placeholder="e.g., Zone A - Miami Beach"
                value={deliveryZoneFormData.zone_name}
                onChange={(e) => {
                  setDeliveryZoneFormData({ ...deliveryZoneFormData, zone_name: e.target.value });
                  if (zoneFormErrors.zone_name) setZoneFormErrors({ ...zoneFormErrors, zone_name: '' });
                }}
              />
              {zoneFormErrors.zone_name && <p className="text-sm text-red-500">{zoneFormErrors.zone_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoneDescription">Description (Optional)</Label>
              <Input
                id="zoneDescription"
                placeholder="e.g., Coastal area including Miami Beach"
                value={deliveryZoneFormData.description}
                onChange={(e) => setDeliveryZoneFormData({ ...deliveryZoneFormData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoneStatus">Status</Label>
              <Select
                value={deliveryZoneFormData.status}
                onValueChange={(value) => setDeliveryZoneFormData({ ...deliveryZoneFormData, status: value })}
              >
                <SelectTrigger id="zoneStatus">
                  <SelectValue placeholder="Select a status">
                    {deliveryZoneFormData.status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeliveryZoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveDeliveryZone} className="rounded-lg bg-[#00a1ff] hover:bg-[#0090e6] text-white text-base font-semibold">
              {currentDeliveryZone ? 'Update Zone' : 'Add Zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={deleteQtyDialogOpen} onOpenChange={setDeleteQtyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the quantity rule for {itemToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQtyRule} className="bg-red-600 hover:bg-red-700">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteZoneDialogOpen} onOpenChange={setDeleteZoneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the zone rule for {itemToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteZoneRule} className="bg-red-600 hover:bg-red-700">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDeliveryZoneDialogOpen} onOpenChange={setDeleteDeliveryZoneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {itemToDelete?.name}? This will also delete all associated zone rules. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDeliveryZone} className="bg-red-600 hover:bg-red-700">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}