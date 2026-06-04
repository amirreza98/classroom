import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
    const navigate = useNavigate();
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full">
                <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <h1 className="text-2xl font-bold">Payment Confirmed!</h1>
                    <p className="text-muted-foreground">
                        Your enrollment has been confirmed. You now have access to the class.
                    </p>
                    <Button className="mt-2 w-full" onClick={() => navigate('/')}>
                        Go to My Dashboard
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
