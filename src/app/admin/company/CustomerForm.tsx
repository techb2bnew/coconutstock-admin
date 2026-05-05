import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, PhoneCall } from "lucide-react";

type CustomerStats = {
  customerForm: any;
  updateCustomer: any;
  customerErrors: any;
  account: any;
};

const CustomerForm = ({
  customerForm,
  updateCustomer,
  customerErrors,
  account,
}: CustomerStats) => {
  return (
    <>
      {!account && (
        <h2 className="text-md font-semibold text-gray-900">
          Main point of Contact - Customer
        </h2>
      )}
      <div className="mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="mx-auto bg-white p-4 rounded-xl shadow">
            {!account && (
              <h2 className="text-xl font-semibold mb-4">Add Customer</h2>
            )}
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div className="grid gap-2">
                <Label>First Name *</Label>
                <Input
                  value={customerForm.customerFirstName}
                  onChange={(e) =>
                    updateCustomer("customerFirstName", e.target.value)
                  }
                  placeholder="Enter first name"
                />
                {customerErrors.customerFirstName && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.customerFirstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className="grid gap-2">
                <Label>Last Name</Label>
                <Input
                  value={customerForm.customerLastName}
                  onChange={(e) =>
                    updateCustomer("customerLastName", e.target.value)
                  }
                  placeholder="Enter last name"
                />
              </div>

              {/* Primary Email */}
              <div className="grid gap-2">
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={customerForm.customerEmail}
                    onChange={(e) =>
                      updateCustomer(
                        "customerEmail",
                        e.target.value.toLowerCase()
                      )
                    }
                    placeholder="email@example.com"
                  />
                </div>
                {customerErrors.customerEmail && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.customerEmail}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="grid gap-2">
                <Label>Phone *</Label>
                <div className="relative">
                  <PhoneCall className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={customerForm.customerPhone}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      updateCustomer("customerPhone", val);
                    }}
                    placeholder="10 digit phone"
                    maxLength={10}
                  />
                </div>
                {customerErrors.customerPhone && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.customerPhone}
                  </p>
                )}
              </div>

              {/* Alternate Email 1 */}
              <div className="grid gap-2">
                <Label>Alternate Email 1</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={customerForm.alternateEmail1 || ""}
                    onChange={(e) =>
                      updateCustomer(
                        "alternateEmail1",
                        e.target.value.toLowerCase()
                      )
                    }
                    placeholder="alternate1@example.com"
                  />
                </div>
                {customerErrors.alternateEmail1 && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.alternateEmail1}
                  </p>
                )}
              </div>

              {/* Alternate Email 2 */}
              <div className="grid gap-2">
                <Label>Alternate Email 2</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={customerForm.alternateEmail2 || ""}
                    onChange={(e) =>
                      updateCustomer(
                        "alternateEmail2",
                        e.target.value.toLowerCase()
                      )
                    }
                    placeholder="alternate2@example.com"
                  />
                </div>
                {customerErrors.alternateEmail2 && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.alternateEmail2}
                  </p>
                )}
              </div>

              {/* Customer Title */}
              <div className="grid gap-2 w-[50%]">
                <Label htmlFor="Customer_title">
                  Customer Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="Customer_title"
                  className={
                    customerErrors.Customer_title ? "border-red-500" : ""
                  }
                  value={customerForm.Customer_title}
                  onChange={(e) =>
                    updateCustomer(
                      "Customer_title",
                      e.target.value.toLowerCase()
                    )
                  }
                  placeholder="Enter title"
                />
                {customerErrors.Customer_title && (
                  <p className="text-red-500 text-xs mt-1">
                    {customerErrors.Customer_title}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerForm;