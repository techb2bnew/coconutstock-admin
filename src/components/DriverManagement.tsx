"use client";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Truck,
  Search,
  UserPlus,
  Eye,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Package,
  Navigation,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { toast } from "sonner";

interface DriverManagementProps {
  locationId: string;
  locationName: string;
}

// Mock driver data with full details
const mockDrivers = [
  {
    id: "DRV-001",
    name: "Sarah Driver",
    phone: "+1 305-555-0201",
    email: "sarah.driver@coconutstock.com",
    status: "Available",
    currentOrders: [],
    totalCapacity: 8,
    vehicle: "VAN-101",
    zone: "Zone A - Miami Beach",
    shiftStart: "08:00 AM",
    shiftEnd: "04:00 PM",
  },
  {
    id: "DRV-002",
    name: "Mike Driver",
    phone: "+1 305-555-0202",
    email: "mike.driver@coconutstock.com",
    status: "En Route",
    currentOrders: [
      { 
        orderId: "ORD-1003", 
        customer: "Hilton Hotel", 
        address: "1601 Collins Ave, Miami Beach",
        sequence: 1,
        eta: "10:30 AM",
        status: "In Transit"
      },
      { 
        orderId: "ORD-1008", 
        customer: "Fontainebleau Resort", 
        address: "4441 Collins Ave, Miami Beach",
        sequence: 2,
        eta: "11:15 AM",
        status: "Pending"
      },
    ],
    totalCapacity: 8,
    vehicle: "VAN-102",
    zone: "Zone A - Miami Beach",
    shiftStart: "07:00 AM",
    shiftEnd: "03:00 PM",
  },
  {
    id: "DRV-003",
    name: "Tom Rodriguez",
    phone: "+1 305-555-0203",
    email: "tom.rodriguez@coconutstock.com",
    status: "Available",
    currentOrders: [],
    totalCapacity: 10,
    vehicle: "TRUCK-201",
    zone: "Zone B - Downtown Miami",
    shiftStart: "09:00 AM",
    shiftEnd: "05:00 PM",
  },
  {
    id: "DRV-004",
    name: "Lisa Anderson",
    phone: "+1 305-555-0204",
    email: "lisa.anderson@coconutstock.com",
    status: "Assigned",
    currentOrders: [
      { 
        orderId: "ORD-2045", 
        customer: "Starbucks Downtown", 
        address: "100 SE 2nd St, Miami",
        sequence: 1,
        eta: "Not departed",
        status: "Assigned"
      },
      { 
        orderId: "ORD-2048", 
        customer: "Whole Foods Brickell", 
        address: "1020 Brickell Ave, Miami",
        sequence: 2,
        eta: "Not departed",
        status: "Assigned"
      },
      { 
        orderId: "ORD-2051", 
        customer: "Fresh Market", 
        address: "2305 SW 37th Ave, Miami",
        sequence: 3,
        eta: "Not departed",
        status: "Assigned"
      },
    ],
    totalCapacity: 10,
    vehicle: "TRUCK-202",
    zone: "Zone B - Downtown Miami",
    shiftStart: "08:00 AM",
    shiftEnd: "04:00 PM",
  },
  {
    id: "DRV-005",
    name: "Carlos Martinez",
    phone: "+1 305-555-0205",
    email: "carlos.martinez@coconutstock.com",
    status: "Assigned",
    currentOrders: [
      { 
        orderId: "ORD-3012", 
        customer: "Publix Kendall", 
        address: "12505 N Kendall Dr, Miami",
        sequence: 1,
        eta: "Not departed",
        status: "Assigned"
      },
    ],
    totalCapacity: 8,
    vehicle: "VAN-103",
    zone: "Zone C - Kendall",
    shiftStart: "10:00 AM",
    shiftEnd: "06:00 PM",
  },
];

export function DriverManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedDriver, setSelectedDriver] = useState<typeof mockDrivers[0] | null>(null);
  const [isDriverDetailsOpen, setIsDriverDetailsOpen] = useState(false);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  
  // Add Driver Form State
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverEmail, setNewDriverEmail] = useState("");
  const [newDriverVehicle, setNewDriverVehicle] = useState("");
  const [newDriverZone, setNewDriverZone] = useState("");
  const [newDriverShiftStart, setNewDriverShiftStart] = useState("08:00 AM");
  const [newDriverShiftEnd, setNewDriverShiftEnd] = useState("04:00 PM");
  const [newDriverCapacity, setNewDriverCapacity] = useState("8");

  // Helper function to get driver status badge color
  const getDriverStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800 border-green-200";
      case "Assigned":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "En Route":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Off Duty":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  // Filter drivers based on search and status
  const filteredDrivers = mockDrivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      driver.vehicle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "All" || driver.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewDriver = (driver: typeof mockDrivers[0]) => {
    setSelectedDriver(driver);
    setIsDriverDetailsOpen(true);
  };

  // Calculate statistics
  const stats = {
    total: mockDrivers.length,
    available: mockDrivers.filter(d => d.status === "Available").length,
    enRoute: mockDrivers.filter(d => d.status === "En Route").length,
    assigned: mockDrivers.filter(d => d.status === "Assigned").length,
    offDuty: mockDrivers.filter(d => d.status === "Off Duty").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl mb-2">Driver Management</h1>
        {/* <p className="text-slate-600">
          Manage drivers, view routes, and track delivery capacity for {locationName}
        </p> */}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Total Drivers</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-green-700 mb-2">Available</p>
                <p className="text-3xl font-bold text-green-700">{stats.available}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-700 mb-2">En Route</p>
                <p className="text-3xl font-bold text-purple-700">{stats.enRoute}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Navigation className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-blue-700 mb-2">Assigned</p>
                <p className="text-3xl font-bold text-blue-700">{stats.assigned}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-600 mb-2">Off Duty</p>
                <p className="text-3xl font-bold text-slate-700">{stats.offDuty}</p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                <Clock className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Search by name, phone, or vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="En Route">En Route</SelectItem>
                  <SelectItem value="Off Duty">Off Duty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full md:w-auto" onClick={() => setIsAddDriverOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No drivers found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{driver.name}</div>
                        <div className="text-sm text-slate-500">{driver.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getDriverStatusColor(driver.status)}>
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-400" />
                        {driver.vehicle}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{driver.zone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{driver.shiftStart} - {driver.shiftEnd}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDriver(driver)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Driver Details Dialog */}
      <Dialog open={isDriverDetailsOpen} onOpenChange={setIsDriverDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Driver Details & Route Information</DialogTitle>
            <DialogDescription>
              View complete driver information, current assignments, and delivery route
            </DialogDescription>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-6 py-4">
              {/* Driver Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Driver Name</Label>
                  <p className="font-medium">{selectedDriver.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Status</Label>
                  <div>
                    <Badge className={getDriverStatusColor(selectedDriver.status)}>
                      {selectedDriver.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  <p className="font-medium">{selectedDriver.phone}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </Label>
                  <p className="font-medium text-sm">{selectedDriver.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Vehicle
                  </Label>
                  <p className="font-medium">{selectedDriver.vehicle}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Zone
                  </Label>
                  <p className="font-medium">{selectedDriver.zone}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Shift Hours
                  </Label>
                  <p className="font-medium">{selectedDriver.shiftStart} - {selectedDriver.shiftEnd}</p>
                </div>
              </div>

              <Separator />

              {/* Assigned Orders & Route */}
              <div>
                <Label className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-600" />
                  Delivery Route & Assigned Orders
                </Label>
                
                {selectedDriver.currentOrders.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-green-800 font-medium">No Current Assignments</p>
                    <p className="text-xs text-green-600 mt-1">This driver is available for new orders</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDriver.currentOrders.map((order, index) => (
                      <div key={order.orderId} className="border border-slate-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold">
                              {order.sequence}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-sm">{order.orderId}</p>
                                <p className="text-sm text-slate-600">{order.customer}</p>
                              </div>
                              <Badge className={
                                order.status === "In Transit" 
                                  ? "bg-purple-100 text-purple-800" 
                                  : "bg-blue-100 text-blue-800"
                              }>
                                {order.status}
                              </Badge>
                            </div>
                            <div className="flex items-start gap-1 text-sm text-slate-600 mb-1">
                              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                              <span>{order.address}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              ETA: {order.eta}
                            </div>
                          </div>
                        </div>
                        {index < selectedDriver.currentOrders.length - 1 && (
                          <div className="flex justify-center mt-2 mb-0">
                            <div className="w-px h-4 bg-slate-300" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Route Summary:</span> {selectedDriver.currentOrders.length} stop{selectedDriver.currentOrders.length !== 1 ? 's' : ''} planned
                        {selectedDriver.status === "En Route" && (
                          <span className="ml-2">• Currently on stop {selectedDriver.currentOrders.findIndex(o => o.status === "In Transit") + 1}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDriverDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Driver Dialog */}
      <Dialog open={isAddDriverOpen} onOpenChange={setIsAddDriverOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Driver</DialogTitle>
            <DialogDescription>
              Enter the details of the new driver to add them to the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500">Driver Name</Label>
                <Input
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="Enter driver name"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Phone Number</Label>
                <Input
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Email Address</Label>
                <Input
                  value={newDriverEmail}
                  onChange={(e) => setNewDriverEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Vehicle</Label>
                <Input
                  value={newDriverVehicle}
                  onChange={(e) => setNewDriverVehicle(e.target.value)}
                  placeholder="Enter vehicle ID"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Zone</Label>
                <Input
                  value={newDriverZone}
                  onChange={(e) => setNewDriverZone(e.target.value)}
                  placeholder="Enter zone"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Shift Start</Label>
                <Input
                  value={newDriverShiftStart}
                  onChange={(e) => setNewDriverShiftStart(e.target.value)}
                  placeholder="Enter shift start time"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Shift End</Label>
                <Input
                  value={newDriverShiftEnd}
                  onChange={(e) => setNewDriverShiftEnd(e.target.value)}
                  placeholder="Enter shift end time"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Capacity</Label>
                <Input
                  value={newDriverCapacity}
                  onChange={(e) => setNewDriverCapacity(e.target.value)}
                  placeholder="Enter total capacity"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDriverOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Add new driver to mockDrivers
                const newDriver = {
                  id: `DRV-${mockDrivers.length + 1}`,
                  name: newDriverName,
                  phone: newDriverPhone,
                  email: newDriverEmail,
                  status: "Available",
                  currentOrders: [],
                  totalCapacity: parseInt(newDriverCapacity, 10),
                  vehicle: newDriverVehicle,
                  zone: newDriverZone,
                  shiftStart: newDriverShiftStart,
                  shiftEnd: newDriverShiftEnd,
                };
                mockDrivers.push(newDriver);
                toast.success("Driver added successfully!");
                setIsAddDriverOpen(false);
              }}
            >
              Add Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}