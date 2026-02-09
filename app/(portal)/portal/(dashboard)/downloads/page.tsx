export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Download } from "lucide-react";
import Image from "next/image";

export default async function DownloadsPage() {
  const { student } = await requirePasswordChanged();

  const accesses = await prisma.digitalProductAccess.findMany({
    where: { studentId: student.id },
    include: {
      digitalProduct: {
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          fileName: true,
        },
      },
    },
    orderBy: { grantedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">My Downloads</h1>
        <p className="text-sm text-muted-foreground">
          Your purchased digital products are available for download here.
        </p>
      </div>

      {accesses.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <FileDown className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No digital products yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Purchase digital products from our shop to see them here.
          </p>
          <Button className="mt-4" asChild>
            <a href="/products">Browse Products</a>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accesses.map((access) => (
            <Card key={access.id} className="overflow-hidden">
              {access.digitalProduct.imageUrl ? (
                <div className="relative aspect-[4/3]">
                  <Image
                    src={access.digitalProduct.imageUrl}
                    alt={access.digitalProduct.title}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                  <FileDown className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <CardContent className="pt-4">
                <h3 className="font-heading font-semibold">
                  {access.digitalProduct.title}
                </h3>
                {access.digitalProduct.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {access.digitalProduct.description}
                  </p>
                )}
                {access.digitalProduct.fileName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {access.digitalProduct.fileName}
                  </p>
                )}
                <Button className="mt-4 w-full gap-2" size="sm" asChild>
                  <a
                    href={`/api/products/download?id=${access.digitalProduct.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
