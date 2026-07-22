import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard/overview";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background p-1">
            <Image
              src="/logo-Tre.png"
              alt="Tre"
              width={32}
              height={15}
              className="h-auto w-full object-contain"
              priority
            />
          </span>
          PMS
        </CardTitle>
        <CardDescription>Đăng nhập để tiếp tục</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
