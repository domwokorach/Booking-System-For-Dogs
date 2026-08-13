interface TermsAndConditionsProps {
  onNavigateHome: () => void;
}

const sections = [
  {
    title: "1. About these terms",
    content: (
      <>
        <p>
          These terms apply when you create a Pawside account or book dog grooming,
          training, daycare, or boarding through this website. Pawside provides its
          services in Essex, UK.
        </p>
        <p>
          Please read these terms before booking. By placing a booking, you confirm
          that the information you provide is accurate and that you agree to these
          terms.
        </p>
      </>
    ),
  },
  {
    title: "2. Accounts and customer information",
    content: (
      <p>
        You must provide accurate contact and booking information, keep your sign-in
        details secure, and tell us promptly if your details change. You are
        responsible for activity carried out through your account unless you have
        notified us that it may have been compromised.
      </p>
    ),
  },
  {
    title: "3. Bookings and availability",
    content: (
      <>
        <p>
          Appointment times are subject to availability. A booking is confirmed only
          when the website shows it as confirmed and any required payment has been
          completed successfully.
        </p>
        <p>
          Please arrive at the agreed time. If you are delayed, contact Pawside as
          soon as possible. A late arrival may require the service to be shortened or
          rescheduled where it cannot be completed safely in the remaining time.
        </p>
      </>
    ),
  },
  {
    title: "4. Prices and payments",
    content: (
      <>
        <p>
          Prices are shown in pounds sterling (GBP). The price presented during
          checkout is the price payable for that booking unless an obvious pricing
          error has occurred.
        </p>
        <p>
          Card payments are processed securely by Stripe. Pawside stores payment
          references and status information but does not store your full card number
          or CVC.
        </p>
      </>
    ),
  },
  {
    title: "5. Cancellations and refunds",
    content: (
      <>
        <p>
          When you request a cancellation, the booking enters cancellation pending
          status. The appointment remains reserved, the booking is not yet cancelled,
          and no refund begins until an administrator approves the request.
        </p>
        <p>
          After approval, the booking is cancelled and any eligible refund is
          submitted through Stripe. A card refund usually appears within 5–10
          business days, depending on your bank or card provider. This processing
          time is controlled by the payment providers and is not a guarantee from
          Pawside.
        </p>
      </>
    ),
  },
  {
    title: "6. Your dog’s health, safety, and behaviour",
    content: (
      <p>
        You must provide relevant and accurate information about your dog, including
        health conditions, medication, allergies, vaccination status, temperament,
        and behaviour that could affect safe care. Pawside may pause, adapt, refuse,
        or end a service where reasonably necessary to protect your dog, other
        animals, customers, or staff.
      </p>
    ),
  },
  {
    title: "7. Reviews and uploaded content",
    content: (
      <p>
        Reviews, photographs, and other content you submit must be accurate, lawful,
        and your own or used with permission. Pawside may remove content that is
        abusive, misleading, unlawful, or unrelated to a completed service.
      </p>
    ),
  },
  {
    title: "8. Service standards and liability",
    content: (
      <>
        <p>
          Pawside will provide its services with reasonable care and skill. Nothing
          in these terms excludes or limits any consumer right or liability that
          cannot legally be excluded or limited.
        </p>
        <p>
          Pawside is not responsible for loss caused by inaccurate or incomplete
          information supplied by you, or for events outside its reasonable control.
          This does not affect your statutory rights.
        </p>
      </>
    ),
  },
  {
    title: "9. Personal information",
    content: (
      <p>
        Pawside uses customer information to manage accounts, appointments, payments,
        refunds, service communications, and reviews. Any separate privacy notice
        provided on the website explains in more detail how personal information is
        used and protected.
      </p>
    ),
  },
  {
    title: "10. Changes to these terms",
    content: (
      <p>
        Pawside may update these terms when its services, booking process, or legal
        obligations change. The latest version and its update date will be published
        on this page. Changes will not retrospectively remove rights that already
        apply to a confirmed booking.
      </p>
    ),
  },
  {
    title: "11. Governing law and contact",
    content: (
      <>
        <p>
          These terms are governed by the laws of England and Wales, without limiting
          any rights a consumer may have to bring a claim in another part of the UK.
        </p>
        <p>
          If you have a question, complaint, or cancellation enquiry, contact Pawside
          using the contact details shown in the website footer.
        </p>
      </>
    ),
  },
];

export function TermsAndConditions({ onNavigateHome }: TermsAndConditionsProps) {
  return (
    <main className="bg-background px-6 py-14 sm:py-20">
      <article className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={onNavigateHome}
          className="mb-8 text-sm font-semibold text-primary transition-colors hover:text-foreground"
        >
          ← Back to Pawside
        </button>

        <header className="rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Pawside policies
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-foreground sm:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: 13 August 2026
          </p>
          <p className="mt-6 max-w-3xl leading-7 text-muted-foreground">
            These terms explain the rules that apply when you use Pawside’s website,
            create an account, and book our dog care services.
          </p>
        </header>

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8"
            >
              <h2 className="font-serif text-2xl font-bold text-foreground">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.content}
              </div>
            </section>
          ))}
        </div>

      </article>
    </main>
  );
}
