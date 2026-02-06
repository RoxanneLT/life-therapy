import Link from "next/link";
import { Flower2, Facebook, Linkedin, Mail, Phone } from "lucide-react";

export function PublicFooter() {
  return (
    <footer>
      {/* Social + newsletter band */}
      <div className="bg-brand-500 px-4 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
          <div className="flex items-center gap-5">
            <a href="https://facebook.com/lifetherapyza" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-white/80">
              <Facebook className="h-6 w-6" />
            </a>
            <a href="https://linkedin.com/in/roxanne-bouwer-03551820a" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-white/80">
              <Linkedin className="h-6 w-6" />
            </a>
            <a href="mailto:hello@life-therapy.co.za" aria-label="Email" className="hover:text-white/80">
              <Mail className="h-6 w-6" />
            </a>
            <a href="https://wa.me/27710170353" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="hover:text-white/80">
              <Phone className="h-6 w-6" />
            </a>
          </div>
          <p className="text-center text-sm font-medium text-white/90">
            Join thousands of people on their growth journey. Sign up for practical tips, new course announcements, and exclusive offers.
          </p>
        </div>
      </div>

      {/* Main footer */}
      <div className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-2">
                <Flower2 className="h-5 w-5 text-brand-500" />
                <span className="font-heading text-lg font-semibold">
                  Life-Therapy
                </span>
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                Online life coaching, counselling, and self-paced courses.
                Empowering you to build confidence and create meaningful change.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground">
                    About Roxanne
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="hover:text-foreground">
                    Online Courses
                  </Link>
                </li>
                <li>
                  <Link href="/sessions" className="hover:text-foreground">
                    1:1 Sessions
                  </Link>
                </li>
                <li>
                  <Link href="/packages" className="hover:text-foreground">
                    Bundles & Packages
                  </Link>
                </li>
                <li>
                  <Link href="/book" className="hover:text-foreground">
                    Book a Free Consultation
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="tel:+27710170353" className="hover:text-foreground">+27 71 017 0353</a>
                </li>
                <li>
                  <a href="mailto:hello@life-therapy.co.za" className="hover:text-foreground">hello@life-therapy.co.za</a>
                </li>
                <li>Mon–Fri: 9 am – 5 pm</li>
                <li>Online Sessions Globally (via MS Teams)</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-8 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Life-Therapy. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
