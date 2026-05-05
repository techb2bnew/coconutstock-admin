"use client";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface PricingManagementProps {
  locationId: string;
  locationName: string;
}

interface VolumeTier {
  id: string;
  min: number;
  max: number;
  discount: number;
}

interface CustomerPricing {
  id: string;
  customer: string;
  customPrice: number;
  unitType: "case" | "unit";
}

export function PricingManagement() {
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([
    { id: "1", min: 1, max: 100, discount: 0 },
    { id: "2", min: 101, max: 200, discount: 5 },
    { id: "3", min: 201, max: 500, discount: 10 },
    { id: "4", min: 501, max: 999999, discount: 15 }
  ]);

  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([
    { id: "1", customer: "Hilton Hotel Miami", customPrice: 4.50, unitType: "unit" },
    { id: "2", customer: "Paradise Events", customPrice: 75.00, unitType: "case" }
  ]);

  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<CustomerPricing | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    customPrice: 0
  });

  const handleUpdatePricing = () => {
    // In a real app, this would make an API call to update pricing
    toast.success("Pricing updated successfully!", {
      description: "Default pricing has been updated for all customers.",
      duration: 3000,
    });
  };

  const handleAddVolumeTier = () => {
    const newTier: VolumeTier = {
      id: Date.now().toString(),
      min: 0,
      max: 0,
      discount: 0
    };
    setVolumeTiers([...volumeTiers, newTier]);
    toast.success("Volume tier added!", {
      description: "New tier row has been added. Don't forget to save your changes.",
      duration: 2000,
    });
  };

  const handleDeleteVolumeTier = (id: string) => {
    if (volumeTiers.length === 1) {
      toast.error("Cannot delete", {
        description: "You must have at least one volume tier.",
        duration: 2000,
      });
      return;
    }
    setVolumeTiers(volumeTiers.filter(tier => tier.id !== id));
    toast.success("Volume tier deleted!", {
      description: "The tier has been removed. Don't forget to save your changes.",
      duration: 2000,
    });
  };

  const handleVolumeTierChange = (id: string, field: keyof VolumeTier, value: number) => {
    setVolumeTiers(volumeTiers.map(tier => 
      tier.id === id ? { ...tier, [field]: value } : tier
    ));
  };

  const handleSaveVolumeTiers = () => {
    // Validate tiers
    const hasInvalidData = volumeTiers.some(tier => 
      tier.min < 0 || tier.max < 0 || tier.discount < 0 || tier.discount > 100 || tier.min > tier.max
    );

    if (hasInvalidData) {
      toast.error("Invalid data", {
        description: "Please check that all values are valid. Min must be less than Max, and discount must be between 0-100%.",
        duration: 3000,
      });
      return;
    }

    // In a real app, this would make an API call to save the volume tiers
    toast.success("Volume tiers saved successfully!", {
      description: `${volumeTiers.length} tier(s) have been updated.`,
      duration: 3000,
    });
  };

  const handleOpenEditCustomerDialog = (customer: CustomerPricing) => {
    setCurrentCustomer(customer);
    setCustomerFormData({ customPrice: customer.customPrice });
    setIsEditCustomerDialogOpen(true);
  };

  const handleCloseEditCustomerDialog = () => {
    setIsEditCustomerDialogOpen(false);
    setCurrentCustomer(null);
    setCustomerFormData({ customPrice: 0 });
  };

  const handleEditCustomerPrice = () => {
    if (!currentCustomer) return;

    const updatedCustomerPricing = customerPricing.map(customer => 
      customer.id === currentCustomer.id ? { ...customer, customPrice: customerFormData.customPrice } : customer
    );

    setCustomerPricing(updatedCustomerPricing);
    toast.success("Customer price updated successfully!", {
      description: "The custom price for this customer has been updated.",
      duration: 3000,
    });

    handleCloseEditCustomerDialog();
  };

  const handleCustomerFormDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerFormData({ customPrice: parseFloat(e.target.value) || 0 });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl mb-2">Pricing & Discounts</h1>
        {/* <p className="text-slate-600">{locationName}</p> */}
      </div>

      {/* Default Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Default Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price per Case</Label>
              <div className="flex gap-2">
                <span className="text-2xl self-center">$</span>
                <Input type="number" defaultValue="75.00" step="0.01" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Price per Unit</Label>
              <div className="flex gap-2">
                <span className="text-2xl self-center">$</span>
                <Input type="number" defaultValue="0.50" step="0.01" />
              </div>
            </div>
          </div>
          <Button onClick={handleUpdatePricing}>Update Default Pricing</Button>
        </CardContent>
      </Card>

      {/* Volume-based Discounts */}
      <Card>
        <CardHeader>
          <CardTitle>Volume-based Discount Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {volumeTiers.map((tier) => (
              <div key={tier.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Quantity</Label>
                    <Input 
                      type="number" 
                      value={tier.min} 
                      onChange={(e) => handleVolumeTierChange(tier.id, "min", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Quantity</Label>
                    <Input 
                      type="number" 
                      value={tier.max} 
                      onChange={(e) => handleVolumeTierChange(tier.id, "max", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Discount %</Label>
                    <Input 
                      type="number" 
                      value={tier.discount} 
                      onChange={(e) => handleVolumeTierChange(tier.id, "discount", parseInt(e.target.value) || 0)} 
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteVolumeTier(tier.id)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddVolumeTier}>
              <Plus className="w-4 h-4 mr-2" />
              Add Volume Tier
            </Button>
            <Button onClick={handleSaveVolumeTiers}>
              <Save className="w-4 h-4 mr-2" />
              Save Volume Tiers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer-specific Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Customer-specific Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {customerPricing.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <div>{item.customer}</div>
                  <div className="text-sm text-slate-500">Custom pricing enabled • Buys by {item.unitType}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Custom Price</div>
                    <div className="text-lg">${item.customPrice.toFixed(2)}/{item.unitType}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditCustomerDialog(item)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Customer Price Dialog */}
      <Dialog open={isEditCustomerDialogOpen} onOpenChange={setIsEditCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Price</DialogTitle>
            <DialogDescription>
              Update the custom price for {currentCustomer?.customer}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Custom Price per {currentCustomer?.unitType === "case" ? "Case" : "Unit"}</Label>
              <Input 
                type="number" 
                value={customerFormData.customPrice} 
                onChange={handleCustomerFormDataChange} 
                step="0.01" 
              />
              <p className="text-xs text-slate-500 mt-1">
                This customer buys by {currentCustomer?.unitType}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditCustomerDialog}>Cancel</Button>
            <Button onClick={handleEditCustomerPrice}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}