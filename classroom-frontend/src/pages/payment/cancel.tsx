import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function PaymentCancelPage() {
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                    <XCircle className="h-16 w-16 text-muted-foreground" />
                    <h1 className="text-2xl font-bold">Payment Cancelled</h1>
                    <p className="text-muted-foreground">
                        Your payment was cancelled. Your enrollment is still pending — you can retry when ready.
                    </p>
                    <Button variant="outline" className="mt-2 w-full" onClick={() => navigate('/')}>
                        Back to Dashboard
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
