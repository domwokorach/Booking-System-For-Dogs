import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Scissors,
  Dumbbell,
  Heart,
  Home,
  Phone,
  MapPin,
  X,
  Check,
  Menu,
  ArrowRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  isSunday,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────
type ServiceId = "grooming" | "training" | "daycare" | "boarding";

interface BookingState {
  service: ServiceId | null;
  time: string | null;
  ownerName: string;
  dogName: string;
  dogBreed: string;
  phone: string;
  notes: string;
}

// ─── Static data ──────────────────────────────────────────────────────
const SERVICES = [
  {
    id: "grooming" as ServiceId,
    name: "Grooming",
    Icon: Scissors,
    price: "£30",
    duration: "~2 hours",
    desc: "Full spa treatment — bath, blow-dry, brush-out, and breed-specific trim.",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    selBg: "bg-amber-50",
    selBorder: "border-amber-300",
  },
  {
    id: "training" as ServiceId,
    name: "Training",
    Icon: Dumbbell,
    price: "£15",
    duration: "1 hour",
    desc: "Private one-on-one sessions: obedience, recall, leash manners, and behavior.",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    selBg: "bg-emerald-50",
    selBorder: "border-emerald-300",
  },
  {
    id: "daycare" as ServiceId,
    name: "Daycare",
    Icon: Heart,
    price: "£45 / day",
    duration: "7 am – 7 pm",
    desc: "Supervised play, enrichment activities, and two structured rest periods.",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    selBg: "bg-rose-50",
    selBorder: "border-rose-300",
  },
  {
    id: "boarding" as ServiceId,
    name: "Boarding",
    Icon: Home,
    price: "£50 / night",
    duration: "Overnight",
    desc: "Home-style stay with evening walks, cozy bedding, and 24/7 care.",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
    selBg: "bg-sky-50",
    selBorder: "border-sky-300",
  },
];

const TIME_SLOTS = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
];

// ─── Helpers ──────────────────────────────────────────────────────────
function buildCalendarDays(month: Date): Date[] {
  const days: Date[] = [];
  let day = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  while (day <= end) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function getAvailableSlots(date: Date): string[] {
  const seed = date.getDate() * 7 + date.getMonth() * 13;
  return TIME_SLOTS.filter((_, i) => (seed + i * 3) % 5 !== 0);
}

function isDateDisabled(date: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(new Date())) || isSunday(date);
}

// ─── App ──────────────────────────────────────────────────────────────
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [booking, setBooking] = useState<BookingState>({
    service: null,
    time: null,
    ownerName: "",
    dogName: "",
    dogBreed: "",
    phone: "",
    notes: "",
  });
  const [step, setStep] = useState<"select" | "form" | "confirmed">("select");

  const calDays = buildCalendarDays(currentMonth);
  const availableSlots = selectedDate ? getAvailableSlots(selectedDate) : [];
  const canProceed = !!(selectedDate && booking.service && booking.time);

  function handleDateClick(date: Date) {
    if (isDateDisabled(date)) return;
    setSelectedDate(date);
    setBooking((b) => ({ ...b, time: null }));
  }

  function handleServiceSelect(id: ServiceId) {
    setBooking((b) => ({ ...b, service: id }));
  }

  function handleTimeSelect(slot: string) {
    setBooking((b) => ({ ...b, time: slot }));
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("confirmed");
  }

  function handleReset() {
    setSelectedDate(null);
    setBooking({
      service: null,
      time: null,
      ownerName: "",
      dogName: "",
      dogBreed: "",
      phone: "",
      notes: "",
    });
    setStep("select");
  }

  function scrollToBooking() {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-bold text-xl tracking-tight font-serif">Pawside</span>
            <span className="hidden sm:block text-muted-foreground text-sm mt-0.5 ml-0.5">
              Dog Services
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Services", "Book", "About"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
            <button
              onClick={scrollToBooking}
              className="bg-primary text-primary-foreground text-sm px-5 py-2 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Book Now
            </button>
          </div>
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-background border-t border-border px-6 py-5 flex flex-col gap-4">
            {["Services", "Book", "About"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="text-muted-foreground text-sm"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <button
              onClick={() => {
                setMenuOpen(false);
                scrollToBooking();
              }}
              className="bg-primary text-primary-foreground text-sm px-5 py-2.5 rounded-lg font-semibold"
            >
              Book Now
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="min-h-screen pt-16 grid md:grid-cols-2">
        {/* Left: dark forest panel */}
        <div className="bg-[#1B2B1B] flex flex-col justify-center px-10 md:px-16 py-24 order-2 md:order-1">
          <p className="text-[#5A8B60] text-xs font-semibold tracking-[0.2em] uppercase mb-6">
            Essex, UK
          </p>
          <h1 className="text-white text-5xl md:text-6xl lg:text-[4.5rem] font-bold font-serif leading-[1.05] mb-8">
            Expert care for your best friend.
          </h1>
          <p className="text-[#A8BFA9] text-lg leading-relaxed mb-10 max-w-md">
            Grooming, training, daycare, and boarding — all under one roof. Book in minutes, relax all day.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={scrollToBooking}
              className="bg-primary text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2.5"
            >
              Book an Appointment
              <ArrowRight size={18} />
            </button>
            <a
              href="#services"
              className="text-white/80 px-8 py-4 rounded-xl text-base font-medium border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Our Services
            </a>
          </div>
          <div className="mt-16 flex gap-12">
            {[
              { value: "500+", label: "Happy dogs" },
              { value: "5★", label: "Avg rating" },
              { value: "4 yrs", label: "In business" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-white text-2xl font-bold font-serif">{s.value}</div>
                <div className="text-[#6A9B6C] text-sm mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Right: photo */}
        <div className="relative order-1 md:order-2 min-h-[55vw] md:min-h-0 bg-stone-200 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&h=1100&fit=crop&auto=format"
            alt="Happy golden retriever sitting in sunlit greenery"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          {/* Floating booking card */}
          <div className="absolute bottom-8 left-8 bg-white rounded-2xl shadow-2xl p-5 max-w-[220px]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Check size={15} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Next appointment</div>
                <div className="text-sm font-semibold text-foreground">Today, 2:00 PM</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              Confirmed — Bella
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="py-24 px-6 bg-secondary/50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14 max-w-xl">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase mb-4">
              What we offer
            </p>
            <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight">
              Services designed around your dog
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((svc) => (
              <div
                key={svc.id}
                className="bg-card rounded-2xl p-7 border border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div
                  className={`w-11 h-11 ${svc.iconBg} rounded-xl flex items-center justify-center mb-5`}
                >
                  <svc.Icon size={20} className={svc.iconColor} />
                </div>
                <h3 className="text-lg font-bold font-serif text-foreground mb-1">
                  {svc.name}
                </h3>
                <p className="text-primary font-semibold text-sm">{svc.price}</p>
                <p className="text-muted-foreground text-xs mb-4">{svc.duration}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{svc.desc}</p>
                <button
                  onClick={scrollToBooking}
                  className="mt-6 text-sm font-semibold text-foreground flex items-center gap-1.5 hover:gap-3 transition-all duration-150"
                >
                  Book now <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Booking ── */}
      <section id="booking" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase mb-4">
              Reserve a spot
            </p>
            <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight mb-3">
              Book an appointment
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg">
              Pick a date, choose a service, and select a time. Confirmation in under a minute.
            </p>
          </div>

          {/* ── Step: Confirmed ── */}
          {step === "confirmed" && (
            <div className="max-w-lg mx-auto text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={36} className="text-emerald-600" />
              </div>
              <h3 className="text-3xl font-bold font-serif text-foreground mb-2">
                {"You're booked!"}
              </h3>
              <p className="text-muted-foreground mb-8">
                {"We've confirmed your appointment. See you soon!"}
              </p>
              <div className="bg-card border border-border rounded-2xl p-7 text-left mb-8">
                <div className="grid grid-cols-2 gap-5">
                  {[
                    {
                      label: "Date",
                      value: selectedDate
                        ? format(selectedDate, "EEEE, MMMM d, yyyy")
                        : "",
                    },
                    { label: "Time", value: booking.time ?? "" },
                    {
                      label: "Service",
                      value:
                        SERVICES.find((s) => s.id === booking.service)?.name ??
                        "",
                    },
                    { label: "Dog", value: booking.dogName },
                    { label: "Owner", value: booking.ownerName },
                    { label: "Phone", value: booking.phone },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {row.label}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleReset}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Book Another Appointment
              </button>
            </div>
          )}

          {/* ── Step: Form ── */}
          {step === "form" && (
            <div className="max-w-xl mx-auto">
              {/* Summary bar */}
              <div className="bg-secondary/60 rounded-xl px-5 py-3.5 mb-8 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">Date: </span>
                    <span className="font-semibold">
                      {selectedDate ? format(selectedDate, "EEE, MMM d") : ""}
                    </span>
                  </span>
                  <span className="hidden sm:block w-px h-4 bg-border" />
                  <span>
                    <span className="text-muted-foreground">Time: </span>
                    <span className="font-semibold">{booking.time}</span>
                  </span>
                  <span className="hidden sm:block w-px h-4 bg-border" />
                  <span>
                    <span className="text-muted-foreground">Service: </span>
                    <span className="font-semibold">
                      {SERVICES.find((s) => s.id === booking.service)?.name}
                    </span>
                  </span>
                </div>
                <button
                  onClick={() => setStep("select")}
                  className="text-xs text-primary font-semibold hover:underline shrink-0"
                >
                  Change
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      Your name
                    </label>
                    <input
                      type="text"
                      required
                      value={booking.ownerName}
                      onChange={(e) =>
                        setBooking((b) => ({ ...b, ownerName: e.target.value }))
                      }
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      {"Dog's name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={booking.dogName}
                      onChange={(e) =>
                        setBooking((b) => ({ ...b, dogName: e.target.value }))
                      }
                      placeholder="Biscuit"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      Breed
                    </label>
                    <input
                      type="text"
                      required
                      value={booking.dogBreed}
                      onChange={(e) =>
                        setBooking((b) => ({ ...b, dogBreed: e.target.value }))
                      }
                      placeholder="Golden Retriever"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">
                      Phone number
                    </label>
                    <input
                      type="tel"
                      required
                      value={booking.phone}
                      onChange={(e) =>
                        setBooking((b) => ({ ...b, phone: e.target.value }))
                      }
                      placeholder="(503) 555-0192"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Notes{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={booking.notes}
                    onChange={(e) =>
                      setBooking((b) => ({ ...b, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder="Allergies, special requests, or anything we should know..."
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("select")}
                    className="px-6 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Step: Select date / service / time ── */}
          {step === "select" && (
            <div className="grid lg:grid-cols-[380px_1fr] gap-8">
              {/* Calendar panel */}
              <div className="bg-card border border-border rounded-2xl p-6 self-start">
                <p className="text-xs font-semibold text-muted-foreground tracking-[0.18em] uppercase mb-5">
                  Select a date
                </p>
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-bold font-serif text-foreground">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <button
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs font-semibold text-muted-foreground py-1.5"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map((day, i) => {
                    const inMonth = isSameMonth(day, currentMonth);
                    const isSelected =
                      selectedDate !== null && isSameDay(day, selectedDate);
                    const isTodayDay = isToday(day);
                    const disabled = isDateDisabled(day);

                    return (
                      <button
                        key={i}
                        onClick={() => inMonth && handleDateClick(day)}
                        disabled={!inMonth || disabled}
                        className={[
                          "h-9 w-full rounded-lg text-sm transition-all duration-100 font-medium",
                          !inMonth && "opacity-0 pointer-events-none",
                          inMonth &&
                            disabled &&
                            "text-muted-foreground/30 cursor-not-allowed",
                          inMonth &&
                            !disabled &&
                            !isSelected &&
                            "hover:bg-muted text-foreground",
                          isSelected &&
                            "bg-primary text-primary-foreground shadow-sm",
                          !isSelected &&
                            isTodayDay &&
                            !disabled &&
                            "ring-2 ring-primary/40 text-primary font-bold",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="mt-5 pt-4 border-t border-border flex items-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-primary inline-block" />
                    Selected
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full ring-2 ring-primary/40 inline-block" />
                    Today
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-muted-foreground/20 inline-block" />
                    Unavailable
                  </span>
                </div>
              </div>

              {/* Right panel */}
              <div className="space-y-5">
                {!selectedDate ? (
                  <div className="bg-card border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-14 min-h-[420px]">
                    <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
                      <ChevronRight size={22} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm max-w-[200px] leading-relaxed">
                      Pick a date on the calendar to see available times
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Service selector */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                      <p className="text-xs font-semibold text-muted-foreground tracking-[0.18em] uppercase mb-4">
                        Choose a service
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {SERVICES.map((svc) => {
                          const selected = booking.service === svc.id;
                          return (
                            <button
                              key={svc.id}
                              onClick={() => handleServiceSelect(svc.id)}
                              className={[
                                "rounded-xl p-4 border text-left transition-all duration-150",
                                selected
                                  ? `${svc.selBg} ${svc.selBorder} border-2`
                                  : "border-border hover:bg-secondary/60",
                              ].join(" ")}
                            >
                              <div
                                className={`w-8 h-8 ${svc.iconBg} rounded-lg flex items-center justify-center mb-2.5`}
                              >
                                <svc.Icon size={15} className={svc.iconColor} />
                              </div>
                              <div className="text-sm font-semibold text-foreground">
                                {svc.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {svc.price}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time slots */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                      <p className="text-xs font-semibold text-muted-foreground tracking-[0.18em] uppercase mb-4">
                        Available times —{" "}
                        {format(selectedDate, "EEEE, MMMM d")}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {TIME_SLOTS.map((slot) => {
                          const avail = availableSlots.includes(slot);
                          const selected = booking.time === slot;
                          return (
                            <button
                              key={slot}
                              onClick={() => avail && handleTimeSelect(slot)}
                              disabled={!avail}
                              className={[
                                "py-3 rounded-xl text-xs font-semibold border transition-all duration-100",
                                selected &&
                                  "bg-primary text-primary-foreground border-primary shadow-sm",
                                !selected &&
                                  avail &&
                                  "border-border text-foreground hover:border-primary/50 hover:bg-secondary/60",
                                !avail &&
                                  "border-border text-muted-foreground/30 cursor-not-allowed line-through",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => canProceed && setStep("form")}
                      disabled={!canProceed}
                      className={[
                        "w-full py-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                        canProceed
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md shadow-sm"
                          : "bg-muted text-muted-foreground cursor-not-allowed",
                      ].join(" ")}
                    >
                      {canProceed ? (
                        <>
                          Continue to booking form{" "}
                          <ArrowRight size={15} />
                        </>
                      ) : (
                        "Select a service and time to continue"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="about" className="py-24 px-6 bg-[#1B2B1B]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <p className="text-[#5A8B60] text-xs font-semibold tracking-[0.18em] uppercase mb-4">
              Real customer feedback
            </p>
            <h2 className="text-4xl md:text-5xl font-bold font-serif text-white leading-tight">
              Reviews from Pawside customers
            </h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-sm text-[#B8CEB9]">
            No genuine customer reviews have been submitted yet.
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-background border-t border-border py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <span className="font-bold text-lg font-serif">Pawside</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Professional dog grooming, training, daycare, and boarding in Essex, UK.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground mb-4">Services</h4>
              <ul className="space-y-2.5">
                {SERVICES.map((s) => (
                  <li key={s.id}>
                    <a
                      href="#booking"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground mb-4">Contact</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  Essex, UK
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0" />
                  (503) 555-0142
                </li>
              </ul>
              <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Mon – Sat: 7 am – 7 pm
                <br />
                Sunday: Closed
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © 2026 Pawside Dog Services. All rights reserved.
            </p>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Instagram"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
