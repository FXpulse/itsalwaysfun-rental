import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export default function NewProductPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">Add new product</h1>
      <p className="text-sm text-slate-500 mb-6">
        Create a new rental inventory item.
      </p>

      <div className="card">
        <ProductForm action={createProduct} submitLabel="Create" />
      </div>
    </div>
  );
}
