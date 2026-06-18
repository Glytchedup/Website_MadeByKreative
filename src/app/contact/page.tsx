import { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about a handmade item or a custom request? Get in touch with Kristol.",
};

export default function ContactPage() {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-4xl font-bold">Get in touch</h1>
      <p className="mt-2 text-muted">
        Questions about an item, a custom color, or an order? Send a note and {siteConfig.maker} will
        get back to you personally.
      </p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
