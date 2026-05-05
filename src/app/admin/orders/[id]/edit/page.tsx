'use client';

import { OrderForm } from '@/components/OrderForm';
import { useParams } from 'next/navigation';

export default function EditOrderPage() {
    const params = useParams();
    const orderId = params.id as string;

    return <OrderForm mode="edit" orderId={orderId} />;
}

