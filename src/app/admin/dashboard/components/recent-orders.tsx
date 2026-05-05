import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const orders = [
    { name: "Liam Johnson", email: "liam@example.com", amount: "$250.00", status: "Fulfilled" },
    { name: "Olivia Smith", email: "olivia@example.com", amount: "$150.00", status: "Fulfilled" },
    { name: "Noah Williams", email: "noah@example.com", amount: "$350.00", status: "Pending" },
    { name: "Emma Brown", email: "emma@example.com", amount: "$450.00", status: "Fulfilled" },
    { name: "James Jones", email: "james@example.com", amount: "$550.00", status: "Cancelled" },
];

export function RecentOrders() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>You made 265 sales this month.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order, index) => (
                <TableRow key={index}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="hidden h-9 w-9 sm:flex">
                                <AvatarImage src={`https://picsum.photos/seed/avatar-${index}/40/40`} alt="Avatar" data-ai-hint="people avatar" />
                                <AvatarFallback>{order.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                                <p className="text-sm font-medium leading-none">{order.name}</p>
                                <p className="text-sm text-muted-foreground">{order.email}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant={order.status === "Fulfilled" ? "secondary" : order.status === "Pending" ? "outline" : "destructive"}>
                            {order.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{order.amount}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
