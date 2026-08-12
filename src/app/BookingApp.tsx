import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Scissors,
  Dumbbell,
  Heart,
  Home,
  Phone,
  MapPin,
  Star,
  X,
  Check,
  Menu,
  ArrowRight,
  LogIn,
  UserPlus,
  CalendarClock,
  Trash2,
  KeyRound,
  Mail,
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
import { io } from "socket.io-client";
import { getStatusStyles } from "./lib/booking-status";
import {
  BUSINESS_TIME_ZONE,
  formatSlotLabel,
  resolveAppointmentDateTime,
} from "./lib/booking-time";

type ServiceId = "grooming" | "training" | "daycare" | "boarding";
type AuthMode = "login" | "register";
type CurrentView = "home" | "login" | "register" | "forgot-password" | "reset-password" | "dashboard" | "delete-appointment-confirm" | "delete-account-confirm" | "delete-account-cancel";
type HomeSection = "services" | "booking" | "about";

interface BookingState {
  service: ServiceId | null;
  time: string | null;
  notes: string;
}

interface UserProfile {
  id: string;
  customerReference: string;
  firstName: string;
  surname: string;
  email: string;
  address: string;
  mobileNumber: string;
}

interface AppointmentRecord {
  id: string;
  serviceId?: string | null;
  dateTime: string;
  durationMinutes?: number;
  status: string;
  service?: string | null;
  notes?: string | null;
  deleteRequestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  review?: { id: string } | null;
  reviewEligibility?: {
    canReview: boolean;
    reason: "AVAILABLE" | "ALREADY_REVIEWED" | "CANCELLED" | "NOT_FINISHED";
    availableAt: string | null;
  };
  paymentStatus?: string | null;
  refundAmountPence?: number | null;
  currency?: string | null;
  stripeRefundId?: string | null;
  refundRequestedAt?: string | null;
  refundedAt?: string | null;
  refundFailedAt?: string | null;
}

interface ReviewRecord {
  id: string;
  customerId: string;
  customerName: string;
  avatarUrl: string;
  rating: number;
  comment: string;
  petName: string;
  petBreed: string;
  createdAt: string;
}

interface AppointmentMutationResponse {
  id?: string;
  serviceId?: string | null;
  dateTime?: string;
  status?: string;
  service?: string | null;
  notes?: string | null;
  deleteRequestedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  notificationRecipient?: string;
  emailDelivered?: boolean;
  checkoutUrl?: string;
  checkoutSessionId?: string;
  paymentStatus?: string;
  refundStatus?: string;
  refundId?: string | null;
  refundAmountPence?: number;
  currency?: string;
  message?: string;
}

interface PaymentReturnState {
  result: "success" | "cancelled";
  sessionId: string | null;
  appointmentId: string | null;
}

interface StoredSession {
  user: UserProfile;
  token: string;
  refreshToken?: string;
}

const API_URL = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/+$/, "");
const SOCKET_BASE =
  import.meta.env.VITE_SOCKET_URL?.trim() ||
  API_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : "");
const SESSION_STORAGE_KEY = "pawside-session";
const LAST_ACTIVITY_STORAGE_KEY = "pawside-last-activity";
const SESSION_UPDATED_EVENT = "pawside-session-updated";
const SESSION_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1_000;
const APPOINTMENT_REFRESH_INTERVAL_MS = 5_000;

let refreshSessionRequest: Promise<string> | null = null;

function readStoredSession(): StoredSession | null {
  const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    const session = JSON.parse(saved) as Partial<StoredSession>;
    return session.user && typeof session.token === "string"
      ? session as StoredSession
      : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function notifySessionUpdated(expired = false) {
  window.dispatchEvent(
    new CustomEvent(SESSION_UPDATED_EVENT, { detail: { expired } }),
  );
}

async function refreshAccessToken(): Promise<string> {
  if (refreshSessionRequest) {
    return refreshSessionRequest;
  }

  refreshSessionRequest = (async () => {
    const session = readStoredSession();
    if (!session?.refreshToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    const data = await response.json().catch(() => null) as {
      accessToken?: string;
      refreshToken?: string;
    } | null;
    if (!response.ok || !data?.accessToken || !data.refreshToken) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    saveStoredSession({
      ...session,
      token: data.accessToken,
      refreshToken: data.refreshToken,
    });
    notifySessionUpdated();
    return data.accessToken;
  })()
    .catch((error: unknown) => {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      window.setTimeout(() => notifySessionUpdated(true), 0);
      throw error;
    })
    .finally(() => {
      refreshSessionRequest = null;
    });

  return refreshSessionRequest;
}

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const session = readStoredSession();
  if (!session) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) {
    return response;
  }

  const accessToken = await refreshAccessToken();
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers });
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SERVICES = [
  {
    id: "grooming" as ServiceId,
    name: "Grooming",
    Icon: Scissors,
    price: "£55",
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
    price: "£75",
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
    price: "£65 / night",
    duration: "Overnight",
    desc: "Home-style stay with evening walks, cozy bedding, and 24/7 care.",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
    selBg: "bg-sky-50",
    selBorder: "border-sky-300",
  },
];

const EMPTY_REVIEW_FORM = {
  rating: 5,
  comment: "",
  petName: "",
  petBreed: "",
};

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

function isDateDisabled(date: Date): boolean {
  return isBefore(startOfDay(date), startOfDay(new Date())) || isSunday(date);
}

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

function formatPaymentAmount(amountPence?: number | null, currency?: string | null): string {
  if (amountPence === undefined || amountPence === null || !currency) {
    return "your payment";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountPence / 100);
}

function resolveAvatarUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const assetBase = API_URL || SOCKET_BASE;
  return `${assetBase.replace(/\/$/, "")}${value.startsWith("/") ? value : `/${value}`}`;
}

function canReviewAppointment(appointment: AppointmentRecord): boolean {
  const status = appointment.status.toLowerCase();
  if (status !== "confirmed" && status !== "rescheduled") {
    return false;
  }

  const appointmentEndsAt =
    new Date(appointment.dateTime).getTime() +
    (appointment.durationMinutes ?? 60) * 60_000;
  return appointmentEndsAt <= Date.now();
}

function formatReviewAvailableAt(value: string): string {
  const availableAt = new Date(value);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(availableAt);

  if (businessDateKey(availableAt) === businessDateKey(new Date())) {
    return `${time} today`;
  }

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(availableAt);
  return `${time} on ${date}`;
}

function reviewAvailabilityMessage(appointment: AppointmentRecord): string {
  const eligibility = appointment.reviewEligibility;
  if (eligibility?.reason === "CANCELLED") {
    return "Cancelled appointments cannot be reviewed.";
  }
  if (eligibility?.reason === "NOT_FINISHED" && eligibility.availableAt) {
    return `You can leave a review after your appointment finishes at ${formatReviewAvailableAt(eligibility.availableAt)}.`;
  }
  if (!eligibility && !canReviewAppointment(appointment)) {
    return "Leave a Review becomes available after this appointment finishes.";
  }
  return "You can now leave a verified customer review.";
}

function businessDateKey(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatNextAppointment(value: string): string {
  const appointmentDate = new Date(value);
  const date =
    businessDateKey(appointmentDate) === businessDateKey(new Date())
      ? "Today"
      : new Intl.DateTimeFormat("en-US", {
          timeZone: BUSINESS_TIME_ZONE,
          month: "short",
          day: "numeric",
        }).format(appointmentDate);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(appointmentDate);

  return `${date} at ${time}`;
}

function appointmentBusinessDate(value: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function homeSectionFromHash(hash: string): HomeSection | null {
  const section = hash.replace(/^#/, "");
  return section === "services" || section === "booking" || section === "about"
    ? section
    : null;
}

export default function BookingApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [booking, setBooking] = useState<BookingState>({
    service: null,
    time: null,
    notes: "",
  });
  const [bookingStep, setBookingStep] = useState<"select" | "form" | "confirmed">("select");
  const [currentView, setCurrentView] = useState<CurrentView>("home");
  const [sectionTarget, setSectionTarget] = useState<HomeSection | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({
    firstName: "",
    surname: "",
    email: "",
    address: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewingAppointmentId, setReviewingAppointmentId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [reviewAvatar, setReviewAvatar] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingNotificationRecipient, setBookingNotificationRecipient] = useState<string | null>(null);
  const [bookingEmailDelivered, setBookingEmailDelivered] = useState<boolean | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.replace(/\/$/, "");
    const result = path === "/payment-success"
      ? "success"
      : path === "/payment-cancelled"
        ? "cancelled"
        : params.get("payment");
    if (result !== "success" && result !== "cancelled") {
      return null;
    }
    return {
      result,
      sessionId: params.get("session_id"),
      appointmentId: params.get("appointmentId"),
    };
  });
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ service: null as ServiceId | null, notes: "" });
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [rescheduleServiceId, setRescheduleServiceId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    currentPassword: "",
    confirmation: "",
  });
  const [accountDeletionToken, setAccountDeletionToken] = useState<string | null>(null);
  const [appointmentDeletionToken, setAppointmentDeletionToken] = useState<string | null>(null);
  const [appointmentDeletionCompleted, setAppointmentDeletionCompleted] = useState(false);

  const canProceed = Boolean(selectedDate && booking.service && booking.time);
  const bookingRequirementsMessage = !selectedDate
    ? "Choose a date to start booking."
    : !booking.service
      ? "Select a service to enable confirmation."
      : !booking.time
        ? "Select an available time to enable confirmation."
        : null;

  const calDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const nextAppointment = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.status.toLowerCase() !== "cancelled" &&
            new Date(appointment.dateTime).getTime() >= Date.now(),
        )
        .sort(
          (left, right) =>
            new Date(left.dateTime).getTime() - new Date(right.dateTime).getTime(),
        )[0] ?? null,
    [appointments],
  );
  const nextAppointmentStatus = nextAppointment
    ? getStatusStyles(nextAppointment.status)
    : null;

  useEffect(() => {
    void loadReviews();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialSection = homeSectionFromHash(window.location.hash);
    const isPasswordResetPath = /\/reset-password\/?$/.test(window.location.pathname);
    const initialPasswordResetToken = isPasswordResetPath
      ? searchParams.get("token")
      : null;
    const deletionToken = searchParams.get("deleteAccountToken");
    const cancellationToken = searchParams.get("cancelDeleteAccountToken");
    const initialAppointmentDeletionToken = searchParams.get("deleteAppointmentToken");
    if (
      searchParams.has("payment") ||
      /\/payment-(success|cancelled)\/?$/.test(window.location.pathname)
    ) {
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    }
    const deletionActionView: CurrentView | null = cancellationToken
      ? "delete-account-cancel"
      : deletionToken
        ? "delete-account-confirm"
        : initialAppointmentDeletionToken
          ? "delete-appointment-confirm"
          : null;

    if (cancellationToken) {
      setAccountDeletionToken(cancellationToken);
    }
    if (deletionToken) {
      setAccountDeletionToken(deletionToken);
    }
    if (initialAppointmentDeletionToken) {
      setAppointmentDeletionToken(initialAppointmentDeletionToken);
    }
    if (deletionActionView) {
      setCurrentView(deletionActionView);
    }
    if (!deletionActionView && isPasswordResetPath) {
      setPasswordResetToken(initialPasswordResetToken);
      setCurrentView("reset-password");
      if (!initialPasswordResetToken) {
        setFeedback("This password reset link is invalid or incomplete.");
      }
    }
    if (!deletionActionView && !isPasswordResetPath && initialSection) {
      setCurrentView("home");
      setSectionTarget(initialSection);
    }

    const savedSession = readStoredSession();
    if (!savedSession) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    setUser(savedSession.user);
    setToken(savedSession.token);
    if (!deletionActionView && !isPasswordResetPath && !initialSection) {
      setCurrentView("dashboard");
    }
  }, []);

  useEffect(() => {
    function handleSessionUpdated(event: Event) {
      const session = readStoredSession();
      if (session) {
        setUser(session.user);
        setToken(session.token);
        return;
      }

      setUser(null);
      setToken(null);
      setAppointments([]);
      setCurrentView("login");
      const expired = (event as CustomEvent<{ expired?: boolean }>).detail?.expired;
      if (expired) {
        setFeedback("Your session expired. Please sign in again.");
      }
    }

    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    return () => window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "home" || !sectionTarget) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      document.getElementById(sectionTarget)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setSectionTarget(null);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [currentView, sectionTarget]);

  useEffect(() => {
    function handleHashChange() {
      const section = homeSectionFromHash(window.location.hash);
      if (section) {
        setCurrentView("home");
        setMenuOpen(false);
        setSectionTarget(section);
      }
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadCurrentUser();
    void loadAppointments();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadAppointments();
      }
    };
    const refreshInterval = window.setInterval(
      refreshWhenVisible,
      APPOINTMENT_REFRESH_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !paymentReturn) {
      return;
    }

    let active = true;
    async function resolvePaymentReturn() {
      try {
        if (paymentReturn.result === "success" && paymentReturn.sessionId) {
          const response = await authenticatedFetch(
            `${API_URL}/api/payments/session/${encodeURIComponent(paymentReturn.sessionId)}`,
          );
          const data = (await response.json()) as {
            paymentStatus?: string;
            message?: string;
          };
          if (!response.ok) {
            throw new Error(data.message || "Unable to verify the Stripe payment.");
          }
          if (active) {
            setFeedback(
              data.paymentStatus === "PAID"
                ? "Payment successful. Your appointment is confirmed and the confirmation email is being sent."
                : data.paymentStatus === "PENDING"
                  ? "Stripe is processing your bank payment. Your appointment will be confirmed automatically when payment succeeds."
                  : "The payment was not completed, so the appointment was not confirmed.",
            );
          }
        } else if (
          paymentReturn.result === "cancelled" &&
          paymentReturn.appointmentId
        ) {
          const response = await authenticatedFetch(
            `${API_URL}/api/payments/appointments/${encodeURIComponent(paymentReturn.appointmentId)}/cancel`,
            {
              method: "POST",
            },
          );
          const data = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(data.message || "Unable to cancel the pending payment.");
          }
          if (active) {
            setFeedback(
              data.message ||
                "Payment was cancelled. The appointment was not confirmed.",
            );
          }
        }
        if (active) {
          setCurrentView("dashboard");
          await loadAppointments();
        }
      } catch (error) {
        if (active) {
          setFeedback((error as Error).message);
        }
      } finally {
        if (active) {
          const url = new URL(window.location.href);
          url.searchParams.delete("payment");
          url.searchParams.delete("session_id");
          url.searchParams.delete("appointmentId");
          const pathname = /\/payment-(success|cancelled)\/?$/.test(url.pathname)
            ? "/"
            : url.pathname;
          window.history.replaceState({}, "", `${pathname}${url.search}${url.hash}`);
          setPaymentReturn(null);
        }
      }
    }

    void resolvePaymentReturn();
    return () => {
      active = false;
    };
  }, [token, paymentReturn]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let timeoutId: number | undefined;
    let lastRecordedAt = 0;

    function readLastActivity() {
      const stored = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    }

    function scheduleLogout(delay = SESSION_INACTIVITY_TIMEOUT_MS) {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(expireSession, Math.max(0, delay));
    }

    function expireSession() {
      const elapsed = Date.now() - readLastActivity();
      if (elapsed < SESSION_INACTIVITY_TIMEOUT_MS) {
        scheduleLogout(SESSION_INACTIVITY_TIMEOUT_MS - elapsed);
        return;
      }

      clearSession();
      setFeedback("You were logged out after 5 minutes of inactivity.");
    }

    function recordActivity() {
      const now = Date.now();
      if (now - lastRecordedAt < 1_000) {
        return;
      }

      lastRecordedAt = now;
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      scheduleLogout();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY && event.newValue) {
        const lastActivity = Number(event.newValue);
        if (Number.isFinite(lastActivity)) {
          scheduleLogout(SESSION_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity));
        }
      }

      if (event.key === SESSION_STORAGE_KEY && event.newValue === null) {
        setUser(null);
        setToken(null);
        setAppointments([]);
        setCurrentView("home");
        setFeedback("You were logged out in another tab.");
      }
    }

    if (!window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    }

    const elapsed = Date.now() - readLastActivity();
    scheduleLogout(SESSION_INACTIVITY_TIMEOUT_MS - elapsed);

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    window.addEventListener("storage", handleStorage);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      window.removeEventListener("storage", handleStorage);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const client = io(SOCKET_BASE, {
      auth: { token },
    });

    const refreshAppointments = () => {
      void loadAppointments();
    };

    client.on("server:connected", refreshAppointments);
    client.on("appointments:created", refreshAppointments);
    client.on("appointments:updated", refreshAppointments);
    client.on("appointments:rescheduled", refreshAppointments);
    client.on("appointments:confirmed", refreshAppointments);
    client.on("appointments:cancelled", refreshAppointments);
    client.on("appointments:deleted", refreshAppointments);

    return () => {
      client.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!selectedDate || !booking.service) {
      setAvailableSlots([]);
      return;
    }

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    void fetchAvailableSlots(dateKey, booking.service);
  }, [selectedDate, booking.service]);

  async function loadAppointments() {
    if (!token) {
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_URL}/api/appointments/mine`);
      if (!response.ok) {
        throw new Error("Unable to load appointments.");
      }
      const data = (await response.json()) as AppointmentRecord[];
      setAppointments(data);
    } catch {
      setFeedback("We could not load your appointments right now.");
    }
  }

  async function loadCurrentUser() {
    if (!token) {
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_URL}/api/users/me`);
      if (!response.ok) {
        throw new Error("Unable to load account.");
      }

      const nextUser = (await response.json()) as UserProfile;
      const session = readStoredSession();
      if (session) {
        saveStoredSession({ ...session, user: nextUser });
      }
      setUser(nextUser);
    } catch {
      // Keep the saved profile available during a temporary API interruption.
    }
  }

  async function loadReviews() {
    try {
      const response = await fetch(`${API_URL}/api/reviews`);
      if (!response.ok) {
        throw new Error("Unable to load reviews.");
      }
      setReviews((await response.json()) as ReviewRecord[]);
    } catch {
      setReviews([]);
    }
  }

  function closeReviewForm() {
    setReviewingAppointmentId(null);
    setReviewForm(EMPTY_REVIEW_FORM);
    setReviewAvatar(null);
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !reviewingAppointmentId || !reviewAvatar) {
      setFeedback("Choose a profile picture before submitting your review.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const uploadBody = new FormData();
      uploadBody.append("file", reviewAvatar);
      const uploadResponse = await authenticatedFetch(`${API_URL}/api/files/upload`, {
        method: "POST",
        body: uploadBody,
      });
      const upload = await uploadResponse.json().catch(() => null) as { url?: string; message?: string } | null;
      if (!uploadResponse.ok || !upload?.url) {
        throw new Error(upload?.message || "Unable to upload your profile picture.");
      }

      const response = await authenticatedFetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointmentId: reviewingAppointmentId,
          avatarUrl: upload.url,
          ...reviewForm,
        }),
      });
      const data = await response.json().catch(() => null) as (ReviewRecord & { message?: string }) | null;
      if (!response.ok || !data?.id) {
        throw new Error(data?.message || "Unable to submit your review.");
      }

      setReviews((current) => [data, ...current.filter((review) => review.id !== data.id)].slice(0, 12));
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === reviewingAppointmentId
            ? { ...appointment, review: { id: data.id } }
            : appointment,
        ),
      );
      closeReviewForm();
      setFeedback("Thank you. Your review is now live on the website.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableSlots(dateKey: string, serviceId: ServiceId) {
    try {
      const response = await fetch(`${API_URL}/api/slots?serviceId=${encodeURIComponent(serviceId)}&date=${dateKey}`);
      if (!response.ok) {
        throw new Error("Unable to load slots.");
      }
      const data = (await response.json()) as { slots: Array<{ startAt: string }> };
      setAvailableSlots(data.slots.map((slot) => slot.startAt));
    } catch {
      setAvailableSlots([]);
    }
  }

  function persistSession(
    nextUser: UserProfile,
    nextToken: string,
    nextRefreshToken: string,
  ) {
    saveStoredSession({
      user: nextUser,
      token: nextToken,
      refreshToken: nextRefreshToken,
    });
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    setUser(nextUser);
    setToken(nextToken);
    setCurrentView("dashboard");
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    setUser(null);
    setToken(null);
    setAppointments([]);
    setCurrentView("home");
    setFeedback("You have been logged out.");
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || deleteAccountForm.confirmation !== "DELETE") {
      setFeedback('Enter your password and type "DELETE" to confirm.');
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/users/me/delete-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deleteAccountForm),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete your account.");
      }

      setDeleteAccountOpen(false);
      setDeleteAccountForm({ currentPassword: "", confirmation: "" });
      setFeedback(data?.message || "Your deletion request is pending approval.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAccountDeletion() {
    if (!accountDeletionToken) {
      setFeedback("This account deletion link is invalid.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/users/delete-account/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accountDeletionToken }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to confirm account deletion.");
      }

      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      window.history.replaceState({}, "", window.location.pathname);
      setUser(null);
      setToken(null);
      setAppointments([]);
      setAccountDeletionToken(null);
      setCurrentView("home");
      setFeedback(data?.message || "Your account has been permanently deleted.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelAccountDeletion() {
    if (!accountDeletionToken) {
      setFeedback("This account deletion link is invalid.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/users/delete-account/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accountDeletionToken }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to cancel the account deletion request.");
      }

      window.history.replaceState({}, "", window.location.pathname);
      setAccountDeletionToken(null);
      setCurrentView(user ? "dashboard" : "home");
      setFeedback(data?.message || "The deletion request was cancelled. Your account remains active.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function cancelAccountDeletionConfirmation() {
    window.history.replaceState({}, "", window.location.pathname);
    setAccountDeletionToken(null);
    setFeedback(null);
    setCurrentView(user ? "dashboard" : "home");
  }

  async function handleConfirmAppointmentDeletion() {
    if (!appointmentDeletionToken) {
      setFeedback("This appointment deletion link is invalid.");
      return;
    }

    setLoading(true);
    setFeedback(null);
    setAppointmentDeletionCompleted(false);

    try {
      const response = await fetch(`${API_URL}/api/appointments/delete/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: appointmentDeletionToken }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to approve the appointment deletion.");
      }

      window.history.replaceState({}, "", window.location.pathname);
      setAppointmentDeletionToken(null);
      setAppointmentDeletionCompleted(true);
      setFeedback(data?.message || "Appointment deletion approved and completed.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function leaveAppointmentDeletionApproval() {
    window.history.replaceState({}, "", window.location.pathname);
    setAppointmentDeletionToken(null);
    setAppointmentDeletionCompleted(false);
    setFeedback(null);
    setCurrentView(user ? "dashboard" : "home");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (authMode === "register" && authForm.password !== authForm.confirmPassword) {
      setFeedback("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : {
              firstName: authForm.firstName,
              surname: authForm.surname,
              email: authForm.email,
              homeAddress: authForm.address,
              mobileNumber: authForm.mobileNumber,
              password: authForm.password,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok) {
        throw new Error(data?.message || "Unable to reach the authentication service. Please try again.");
      }

      if (!data?.user || !data?.token || !data?.refreshToken) {
        throw new Error("The authentication service returned an invalid response.");
      }

      persistSession(
        data.user as UserProfile,
        data.token as string,
        data.refreshToken as string,
      );
      setFeedback(authMode === "login" ? "Welcome back!" : "Your account is ready.");
      setAuthForm({
        firstName: "",
        surname: "",
        email: "",
        address: "",
        mobileNumber: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function clearPasswordResetUrl() {
    const appPath = window.location.pathname.replace(/\/reset-password\/?$/, "/") || "/";
    window.history.replaceState({}, "", appPath);
  }

  function showForgotPassword() {
    clearPasswordResetUrl();
    setPasswordResetToken(null);
    setResetPasswordForm({ password: "", confirmPassword: "" });
    setCurrentView("forgot-password");
    setFeedback(null);
  }

  function showSignIn(message: string | null = null) {
    clearPasswordResetUrl();
    setPasswordResetToken(null);
    setResetPasswordForm({ password: "", confirmPassword: "" });
    setAuthMode("login");
    setCurrentView("login");
    setFeedback(message);
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authForm.email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to request a password reset. Please try again.");
      }

      setFeedback(
        data?.message || "If the email exists, a password reset link has been sent.",
      );
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!passwordResetToken) {
      setFeedback("This password reset link is invalid or incomplete.");
      return;
    }
    if (resetPasswordForm.password.length < 8) {
      setFeedback("Your new password must be at least 8 characters.");
      return;
    }
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setFeedback("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: passwordResetToken,
          password: resetPasswordForm.password,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Unable to reset your password. Please request a new link.");
      }

      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      setUser(null);
      setToken(null);
      setAppointments([]);
      showSignIn("Password reset successful. Sign in with your new password.");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleDateClick(date: Date) {
    if (isDateDisabled(date)) {
      return;
    }
    setSelectedDate(date);
    setBooking((current) => ({ ...current, time: null }));
  }

  function showMonth(month: Date) {
    setCurrentMonth(startOfMonth(month));
    setSelectedDate(null);
    setAvailableSlots([]);
    setBooking((current) => ({ ...current, time: null }));
  }

  function handleMonthSelect(monthIndex: number) {
    const month = new Date(currentMonth);
    month.setDate(1);
    month.setMonth(monthIndex);
    showMonth(month);
  }

  function handleServiceSelect(id: ServiceId) {
    setBooking((current) => ({ ...current, service: id }));
  }

  function handleTimeSelect(slot: string) {
    setBooking((current) => ({ ...current, time: slot }));
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedDate || !booking.service || !booking.time) {
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const appointmentDateTime = resolveAppointmentDateTime(selectedDate, booking.time);
      const response = await authenticatedFetch(`${API_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateTime: appointmentDateTime,
          service: booking.service,
          notes: booking.notes || undefined,
        }),
      });

      const data = (await response.json()) as AppointmentMutationResponse;
      if (!response.ok) {
        throw new Error(data.message || "Unable to create the appointment.");
      }

      if (!data.checkoutUrl) {
        throw new Error("Stripe Checkout is unavailable for this appointment.");
      }

      setFeedback("Appointment reserved. Redirecting to secure Stripe Checkout...");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppointmentAction(appointmentId: string, action: "confirm" | "cancel") {
    if (!token) {
      return;
    }
    const selectedAppointment = appointments.find(
      (appointment) => appointment.id === appointmentId,
    );
    if (action === "cancel") {
      const paid = selectedAppointment?.paymentStatus === "PAID";
      const confirmed = window.confirm(
        paid
          ? "Are you sure you want to cancel this appointment and request a full refund?"
          : "Are you sure you want to cancel this appointment?",
      );
      if (!confirmed) {
        return;
      }
    }
    setLoading(true);
    try {
      const requiresPayment =
        action === "confirm" &&
        selectedAppointment?.status.toLowerCase() === "pending";
      const endpoint =
        requiresPayment
          ? `${API_URL}/api/payments/checkout/${appointmentId}`
          : `${API_URL}/api/appointments/${appointmentId}/${action}`;
      const response = await authenticatedFetch(endpoint, {
        method: requiresPayment ? "POST" : "PATCH",
      });
      const data = (await response.json()) as AppointmentMutationResponse;
      if (!response.ok) {
        throw new Error(data.message || `Unable to ${action} the appointment.`);
      }

      if (action === "confirm" && data.checkoutUrl) {
        setFeedback("Redirecting to secure Stripe Checkout...");
        window.location.assign(data.checkoutUrl);
        return;
      }

      if (action === "confirm" && data.notificationRecipient) {
        setBookingNotificationRecipient(data.notificationRecipient);
      }

      const refundAmount = formatPaymentAmount(
        data.refundAmountPence,
        data.currency,
      );
      setFeedback(
        data.refundStatus === "REFUND_PENDING"
          ? `Booking cancelled. Your refund of ${refundAmount} is processing. Most card refunds appear within approximately 5–10 business days, depending on your bank.`
          : data.refundStatus === "REFUNDED"
            ? `Booking cancelled. Your refund of ${refundAmount} has been processed. Please allow approximately 5–10 business days for it to appear, depending on your bank.`
            : data.refundStatus === "REFUND_FAILED"
              ? `Booking cancelled, but Stripe could not complete your refund of ${refundAmount}. Please contact us so we can arrange an alternative refund.`
              : action === "confirm" && data.emailDelivered && data.notificationRecipient
          ? `Appointment confirmed. A confirmation email has been sent to ${data.notificationRecipient}.`
          : action === "confirm"
            ? "Appointment confirmed, but the confirmation email could not be delivered. Please check your registered email address or contact us."
            : "Appointment cancelled.",
      );
      await loadAppointments();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAppointment(appointmentId: string) {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/appointments/${appointmentId}/delete-request`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to request deletion.");
      }

      setFeedback(data.message || "Deletion request sent for approval.");
      void loadAppointments();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditAppointment(appointmentId: string) {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service: editDraft.service || undefined,
          notes: editDraft.notes || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to update the appointment.");
      }
      setEditingAppointmentId(null);
      setFeedback("Appointment details updated.");
      void loadAppointments();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRescheduleAppointment(appointmentId: string) {
    if (!token || !rescheduleDate || !rescheduleTime) {
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/appointments/${appointmentId}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateTime: resolveAppointmentDateTime(rescheduleDate, rescheduleTime),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to reschedule the appointment.");
      }
      setRescheduleAppointmentId(null);
      setRescheduleServiceId(null);
      setRescheduleDate(null);
      setRescheduleTime(null);
      setFeedback("Appointment rescheduled.");
      void loadAppointments();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!rescheduleDate || !rescheduleServiceId || !rescheduleAppointmentId || !token) {
      setRescheduleSlots([]);
      return;
    }

    const dateKey = format(rescheduleDate, "yyyy-MM-dd");
    void fetchRescheduleSlots(dateKey, rescheduleAppointmentId);
  }, [rescheduleDate, rescheduleServiceId, rescheduleAppointmentId, token]);

  async function fetchRescheduleSlots(dateKey: string, appointmentId: string) {
    try {
      const response = await authenticatedFetch(
        `${API_URL}/api/appointments/${encodeURIComponent(appointmentId)}/slots?date=${dateKey}`,
      );
      if (!response.ok) {
        throw new Error("Unable to load reschedule slots.");
      }
      const data = (await response.json()) as { availableTimes: string[] };
      setRescheduleSlots(data.availableTimes);
    } catch {
      setRescheduleSlots([]);
    }
  }

  function navigateToSection(section: HomeSection) {
    const nextUrl = `${window.location.pathname}${window.location.search}#${section}`;
    window.history.pushState({}, "", nextUrl);
    setCurrentView("home");
    setMenuOpen(false);
    setSectionTarget(section);
  }

  function scrollToBooking() {
    navigateToSection("booking");
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button className="flex items-center gap-2.5" onClick={() => setCurrentView("home")}>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-bold text-xl tracking-tight font-serif">Pawside</span>
          </button>
          <div className="hidden md:flex items-center gap-6">
            <a href="#services" onClick={(event) => { event.preventDefault(); navigateToSection("services"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
            <button onClick={scrollToBooking} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Book</button>
            <a href="#about" onClick={(event) => { event.preventDefault(); navigateToSection("about"); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
            {user ? (
              <>
                <button onClick={() => setCurrentView("dashboard")} className="text-sm font-semibold text-foreground">My Account</button>
                <button onClick={clearSession} className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg font-semibold">Logout</button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthMode("login"); setCurrentView("login"); }} className="text-sm font-semibold text-foreground">Sign In</button>
                <button onClick={() => { setAuthMode("register"); setCurrentView("register"); }} className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg font-semibold">Register</button>
              </>
            )}
          </div>
          <button className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-background border-t border-border px-6 py-5 flex flex-col gap-4">
            <a href="#services" className="text-muted-foreground text-sm" onClick={(event) => { event.preventDefault(); navigateToSection("services"); }}>Services</a>
            <button onClick={scrollToBooking} className="text-muted-foreground text-sm text-left">Book</button>
            <a href="#about" className="text-muted-foreground text-sm" onClick={(event) => { event.preventDefault(); navigateToSection("about"); }}>About</a>
            {user ? (
              <>
                <button onClick={() => { setCurrentView("dashboard"); setMenuOpen(false); }} className="text-sm font-semibold text-left">My Account</button>
                <button onClick={() => { clearSession(); setMenuOpen(false); }} className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg font-semibold">Logout</button>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthMode("login"); setCurrentView("login"); setMenuOpen(false); }} className="text-sm font-semibold text-left">Sign In</button>
                <button onClick={() => { setAuthMode("register"); setCurrentView("register"); setMenuOpen(false); }} className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg font-semibold">Register</button>
              </>
            )}
          </div>
        )}
      </nav>

      <div className="pt-16">
        {currentView === "delete-appointment-confirm" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className={`w-full max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm ${appointmentDeletionCompleted ? "border-emerald-200" : "border-red-200"}`}>
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${appointmentDeletionCompleted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {appointmentDeletionCompleted ? <Check size={22} /> : <Trash2 size={22} />}
              </div>
              <p className={`mt-6 text-sm font-semibold uppercase tracking-[0.2em] ${appointmentDeletionCompleted ? "text-emerald-700" : "text-red-700"}`}>Administrator approval</p>
              <h2 className="mt-2 text-3xl font-bold font-serif text-foreground">
                {appointmentDeletionCompleted ? "Appointment deleted" : "Review appointment deletion"}
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {appointmentDeletionCompleted
                  ? "The request was approved and the appointment has been permanently removed. This approval link cannot be used again."
                  : "Approving this request permanently removes the appointment. This secure link expires after 30 minutes and can be used only once."}
              </p>
              {feedback ? (
                <div role={appointmentDeletionCompleted ? "status" : "alert"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${appointmentDeletionCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  {feedback}
                </div>
              ) : null}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {!appointmentDeletionCompleted ? (
                  <button
                    type="button"
                    onClick={handleConfirmAppointmentDeletion}
                    disabled={loading || !appointmentDeletionToken}
                    className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Approving deletion..." : "Approve and delete appointment"}
                  </button>
                ) : null}
                <button type="button" onClick={leaveAppointmentDeletionApproval} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground">
                  {appointmentDeletionCompleted ? "Return home" : "Leave without deleting"}
                </button>
              </div>
            </div>
          </section>
        ) : currentView === "delete-account-cancel" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-emerald-200 bg-card p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={22} />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">My Account</p>
              <h2 className="mt-2 text-3xl font-bold font-serif text-foreground">Cancel delete request</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Cancel the pending deletion request and keep your Pawside account and appointments active.
              </p>
              {feedback ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div> : null}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={handleCancelAccountDeletion}
                  disabled={loading || !accountDeletionToken}
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Cancelling request..." : "Cancel Delete Request"}
                </button>
                <button type="button" onClick={cancelAccountDeletionConfirmation} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground">
                  Leave request pending
                </button>
              </div>
            </div>
          </section>
        ) : currentView === "delete-account-confirm" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-card p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                <Trash2 size={22} />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-red-700">My Account</p>
              <h2 className="mt-2 text-3xl font-bold font-serif text-foreground">Review account deletion request</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                This permanently deletes the user profile and every appointment linked to it. Approve only if you want the deletion to proceed.
              </p>
              {feedback ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div> : null}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={handleConfirmAccountDeletion}
                  disabled={loading || !accountDeletionToken}
                  className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Deleting account..." : "Approve and delete account"}
                </button>
                <button type="button" onClick={cancelAccountDeletionConfirmation} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground">
                  Keep account active
                </button>
              </div>
            </div>
          </section>
        ) : currentView === "forgot-password" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-[0.2em]">Account recovery</p>
                  <h2 className="text-3xl font-bold font-serif text-foreground">Forgot your password?</h2>
                </div>
                <Mail className="text-primary" size={24} />
              </div>
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                Enter the email address for your Pawside account. We’ll send you a secure link that expires in one hour.
              </p>
              {feedback ? <div role="status" aria-live="polite" className="mb-5 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <div>
                  <label htmlFor="forgot-password-email" className="mb-1.5 block text-sm font-medium text-foreground">Email address</label>
                  <input
                    id="forgot-password-email"
                    type="email"
                    autoComplete="email"
                    value={authForm.email}
                    onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <button disabled={loading} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70">
                  {loading ? "Sending reset link..." : "Send Reset Link"}
                </button>
              </form>
              <button type="button" onClick={() => showSignIn()} className="mt-6 text-sm font-semibold text-foreground hover:text-primary">
                Back to sign in
              </button>
            </div>
          </section>
        ) : currentView === "reset-password" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-[0.2em]">Account recovery</p>
                  <h2 className="text-3xl font-bold font-serif text-foreground">Choose a new password</h2>
                </div>
                <KeyRound className="text-primary" size={24} />
              </div>
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                Use at least 8 characters. After resetting your password, you’ll return to sign in.
              </p>
              {feedback ? <div role="alert" className="mb-5 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={resetPasswordForm.password}
                    onChange={(event) => setResetPasswordForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-foreground">Confirm new password</label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={resetPasswordForm.confirmPassword}
                    onChange={(event) => setResetPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                    required
                  />
                </div>
                <button disabled={loading || !passwordResetToken} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70">
                  {loading ? "Resetting password..." : "Reset Password"}
                </button>
              </form>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <button type="button" onClick={showForgotPassword} className="font-semibold text-foreground hover:text-primary">Request a new link</button>
                <button type="button" onClick={() => showSignIn()} className="font-semibold text-foreground hover:text-primary">Back to sign in</button>
              </div>
            </div>
          </section>
        ) : currentView === "login" || currentView === "register" ? (
          <section className="min-h-[calc(100vh-4rem)] px-6 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-[0.2em]">Welcome</p>
                  <h2 className="text-3xl font-bold font-serif text-foreground">{authMode === "login" ? "Sign in to your account" : "Create your account"}</h2>
                </div>
                {authMode === "login" ? <LogIn className="text-primary" size={24} /> : <UserPlus className="text-primary" size={24} />}
              </div>
              {feedback ? <div className="mb-5 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}
              <form className="space-y-4" onSubmit={handleAuthSubmit}>
                {authMode === "register" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={authForm.firstName} onChange={(event) => setAuthForm((current) => ({ ...current, firstName: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="First name" required />
                      <input value={authForm.surname} onChange={(event) => setAuthForm((current) => ({ ...current, surname: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Surname" required />
                    </div>
                    <input value={authForm.address} onChange={(event) => setAuthForm((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Address" required />
                    <input value={authForm.mobileNumber} onChange={(event) => setAuthForm((current) => ({ ...current, mobileNumber: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Mobile number" required />
                  </>
                ) : null}
                <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Email address" required />
                <input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={authMode === "register" ? 8 : undefined} value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Password" required />
                {authMode === "login" ? (
                  <div className="text-right">
                    <button type="button" onClick={showForgotPassword} className="text-sm font-semibold text-foreground hover:text-primary">Forgot password?</button>
                  </div>
                ) : null}
                {authMode === "register" ? (
                  <input type="password" value={authForm.confirmPassword} onChange={(event) => setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm" placeholder="Confirm password" required />
                ) : null}
                <button disabled={loading} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70">
                  {loading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>
              <div className="mt-6 text-sm text-muted-foreground">
                {authMode === "login" ? (
                  <>
                    Need an account? <button className="font-semibold text-foreground" onClick={() => { setAuthMode("register"); setFeedback(null); }}>Create one here</button>
                  </>
                ) : (
                  <>
                    Already registered? <button className="font-semibold text-foreground" onClick={() => { setAuthMode("login"); setFeedback(null); }}>Sign in instead</button>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : currentView === "dashboard" && user ? (
          <section className="px-6 py-16">
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Your account</p>
                    <h2 className="text-3xl font-bold font-serif text-foreground">{user.firstName} {user.surname}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <p><span className="font-semibold text-foreground">Customer reference:</span> <span className="font-mono tracking-wide">{user.customerReference || "Loading..."}</span></p>
                    <p><span className="font-semibold text-foreground">Address:</span> {user.address}</p>
                    <p><span className="font-semibold text-foreground">Mobile:</span> {user.mobileNumber}</p>
                  </div>
                </div>
              </div>

              {feedback ? <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}

              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Upcoming bookings</p>
                      <h3 className="text-2xl font-bold font-serif text-foreground">Manage your appointments</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Delete sends a request to Dominic for approval before anything is removed.</p>
                    </div>
                    <CalendarClock className="text-primary" size={24} />
                  </div>
                  <div className="space-y-4">
                    {appointments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No appointments yet. Use the booking panel to create one.</div>
                    ) : appointments.map((appointment) => {
                      const status = getStatusStyles(appointment.status);
                      const isEditing = editingAppointmentId === appointment.id;
                      const isRescheduling = rescheduleAppointmentId === appointment.id;
                      const deletionRequested = Boolean(appointment.deleteRequestedAt);
                      const canLeaveReview =
                        appointment.reviewEligibility?.canReview ??
                        canReviewAppointment(appointment);
                      const refundAmount = formatPaymentAmount(
                        appointment.refundAmountPence,
                        appointment.currency,
                      );

                      return (
                        <div key={appointment.id} className="rounded-2xl border border-border bg-background p-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{formatAppointmentDate(appointment.dateTime)}</p>
                              <p className="text-sm text-muted-foreground">{appointment.service ? appointment.service : "Service pending"}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
                          </div>
                          {appointment.notes ? <p className="mt-3 text-sm text-muted-foreground">{appointment.notes}</p> : null}
                          {appointment.paymentStatus === "REFUND_PENDING" ? (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                              <p className="font-semibold">Refund processing — {refundAmount}</p>
                              <p className="mt-1">Most card refunds appear within approximately 5–10 business days, depending on your bank.</p>
                            </div>
                          ) : appointment.paymentStatus === "REFUNDED" ? (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                              <p className="font-semibold">Refund completed — {refundAmount}</p>
                              <p className="mt-1">The refund has been processed. Your bank may take approximately 5–10 business days to display it.</p>
                            </div>
                          ) : appointment.paymentStatus === "REFUND_FAILED" ? (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                              <p className="font-semibold">Refund requires attention — {refundAmount}</p>
                              <p className="mt-1">Stripe could not complete the refund. Please contact us so we can arrange an alternative.</p>
                            </div>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {appointment.status.toLowerCase() === "pending" || appointment.status.toLowerCase() === "rescheduled" ? (
                              <button onClick={() => handleAppointmentAction(appointment.id, "confirm")} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                {appointment.status.toLowerCase() === "pending" ? "Pay now" : "Confirm"}
                              </button>
                            ) : null}
                            {appointment.status.toLowerCase() !== "cancelled" ? (
                              <button onClick={() => handleAppointmentAction(appointment.id, "cancel")} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">Cancel</button>
                            ) : null}
                            <button onClick={() => handleDeleteAppointment(appointment.id)} disabled={loading} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                              <span className="inline-flex items-center gap-1">
                                <Trash2 size={14} />
                                {deletionRequested ? "Resend deletion approval" : "Delete"}
                              </span>
                            </button>
                            <button onClick={() => { setEditingAppointmentId(appointment.id); setEditDraft({ service: (appointment.serviceId ?? SERVICES.find((service) => service.name === appointment.service)?.id ?? null) as ServiceId | null, notes: appointment.notes || "" }); }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Edit</button>
                            <button onClick={() => { setRescheduleAppointmentId(appointment.id); setRescheduleServiceId(appointment.serviceId ?? SERVICES.find((service) => service.name === appointment.service)?.id ?? null); setRescheduleDate(appointmentBusinessDate(appointment.dateTime)); setRescheduleTime(null); }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Reschedule</button>
                            {appointment.review ? (
                              <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Review submitted</span>
                            ) : (
                              <button
                                type="button"
                                disabled={!canLeaveReview}
                                onClick={() => {
                                  setReviewingAppointmentId(appointment.id);
                                  setReviewForm(EMPTY_REVIEW_FORM);
                                  setReviewAvatar(null);
                                  setFeedback(null);
                                }}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-500"
                              >
                                Leave a Review
                              </button>
                            )}
                          </div>
                          {!appointment.review ? (
                            <p className={`mt-3 text-xs ${canLeaveReview ? "text-emerald-700" : "text-muted-foreground"}`}>
                              {reviewAvailabilityMessage(appointment)}
                            </p>
                          ) : null}
                          {deletionRequested ? (
                            <p className="mt-3 text-sm text-muted-foreground">A deletion request has been sent to Dominic for approval. The appointment will remain until it is approved and removed. You can resend the request to replace an expired link.</p>
                          ) : null}
                          {reviewingAppointmentId === appointment.id ? (
                            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Rate your completed appointment</p>
                                <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <button
                                      key={rating}
                                      type="button"
                                      role="radio"
                                      aria-checked={reviewForm.rating === rating}
                                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                                      onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                                      className="rounded p-1"
                                    >
                                      <Star size={24} className={rating <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label htmlFor={`review-pet-${appointment.id}`} className="mb-1 block text-sm font-medium text-foreground">Pet name</label>
                                  <input
                                    id={`review-pet-${appointment.id}`}
                                    value={reviewForm.petName}
                                    onChange={(event) => setReviewForm((current) => ({ ...current, petName: event.target.value }))}
                                    maxLength={80}
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                    required
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`review-breed-${appointment.id}`} className="mb-1 block text-sm font-medium text-foreground">Pet breed</label>
                                  <input
                                    id={`review-breed-${appointment.id}`}
                                    value={reviewForm.petBreed}
                                    onChange={(event) => setReviewForm((current) => ({ ...current, petBreed: event.target.value }))}
                                    maxLength={80}
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                    required
                                  />
                                </div>
                              </div>
                              <div>
                                <label htmlFor={`review-avatar-${appointment.id}`} className="mb-1 block text-sm font-medium text-foreground">Avatar or profile picture</label>
                                <input
                                  id={`review-avatar-${appointment.id}`}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(event) => setReviewAvatar(event.target.files?.[0] ?? null)}
                                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                  required
                                />
                                <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP. Maximum size 5 MB.</p>
                              </div>
                              <div>
                                <label htmlFor={`review-comment-${appointment.id}`} className="mb-1 block text-sm font-medium text-foreground">Your review</label>
                                <textarea
                                  id={`review-comment-${appointment.id}`}
                                  value={reviewForm.comment}
                                  onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                                  minLength={20}
                                  maxLength={2000}
                                  rows={5}
                                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                  placeholder="Tell other customers about your experience."
                                  required
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                                  {loading ? "Submitting review..." : "Submit Review"}
                                </button>
                                <button type="button" onClick={closeReviewForm} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold">Cancel</button>
                              </div>
                            </form>
                          ) : null}
                          {isEditing ? (
                            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                              <select value={editDraft.service ?? ""} onChange={(event) => setEditDraft((current) => ({ ...current, service: (event.target.value || null) as ServiceId | null }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                                <option value="">Select a service</option>
                                {SERVICES.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                              </select>
                              <textarea value={editDraft.notes} onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" rows={3} placeholder="Notes" />
                              <div className="mt-3 flex gap-2">
                                <button onClick={() => handleEditAppointment(appointment.id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Save</button>
                                <button onClick={() => setEditingAppointmentId(null)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button>
                              </div>
                            </div>
                          ) : null}
                          {isRescheduling ? (
                            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                              <input type="date" value={rescheduleDate ? format(rescheduleDate, "yyyy-MM-dd") : ""} onChange={(event) => setRescheduleDate(event.target.value ? parseDateInput(event.target.value) : null)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {rescheduleSlots.length === 0 ? <p className="col-span-2 text-sm text-muted-foreground">Choose a date to see available times.</p> : rescheduleSlots.map((slot) => (
                                  <button key={slot} onClick={() => setRescheduleTime(slot)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${rescheduleTime === slot ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{formatSlotLabel(slot)}</button>
                                ))}
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button onClick={() => handleRescheduleAppointment(appointment.id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Save reschedule</button>
                                <button onClick={() => { setRescheduleAppointmentId(null); setRescheduleServiceId(null); setRescheduleDate(null); setRescheduleTime(null); }} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                  <div className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Book a new slot</p>
                    <h3 className="text-2xl font-bold font-serif text-foreground">Reserve a time and month</h3>
                  </div>
                  {bookingStep === "confirmed" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
                      <p className="font-semibold">Your appointment is confirmed.</p>
                      <p className="mt-2">
                        {bookingEmailDelivered
                          ? `A confirmation email has been sent${bookingNotificationRecipient ? ` to ${bookingNotificationRecipient}.` : "."}`
                          : "The confirmation email could not be delivered. Please check your registered email address or contact us."}
                      </p>
                      <button onClick={() => setBookingStep("select")} className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Book another visit</button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground">Select a month and date</span>
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label="Previous month" onClick={() => showMonth(subMonths(currentMonth, 1))} className="rounded-lg border border-border p-2"><ChevronLeft size={16} /></button>
                          <select
                            aria-label="Select month"
                            value={currentMonth.getMonth()}
                            onChange={(event) => handleMonthSelect(Number(event.target.value))}
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
                          >
                            {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                          </select>
                          <span className="min-w-10 text-center text-sm font-semibold text-foreground">{format(currentMonth, "yyyy")}</span>
                          <button type="button" aria-label="Next month" onClick={() => showMonth(addMonths(currentMonth, 1))} className="rounded-lg border border-border p-2"><ChevronRight size={16} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => <div key={day}>{day}</div>)}
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {calDays.map((day, index) => {
                          const inMonth = isSameMonth(day, currentMonth);
                          const disabled = isDateDisabled(day);
                          const selected = selectedDate !== null && isSameDay(day, selectedDate);

                          return (
                            <button key={`${day.toISOString()}-${index}`} onClick={() => inMonth && handleDateClick(day)} disabled={!inMonth || disabled} className={`h-9 rounded-lg text-sm ${selected ? "bg-primary text-primary-foreground" : inMonth && !disabled ? "hover:bg-muted" : "text-muted-foreground/40"}`}>
                              {format(day, "d")}
                            </button>
                          );
                        })}
                      </div>
                      {selectedDate ? (
                        <div className="mt-6 space-y-4">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {SERVICES.map((service) => {
                              const selected = booking.service === service.id;
                              return (
                                <button key={service.id} onClick={() => handleServiceSelect(service.id)} className={`rounded-xl border p-3 text-left ${selected ? "border-primary bg-primary/5" : "border-border"}`}>
                                  <div className="text-sm font-semibold text-foreground">{service.name}</div>
                                  <div className="text-xs text-muted-foreground">{service.price}</div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {availableSlots.length === 0 ? <p className="col-span-2 text-sm text-muted-foreground">No slots available for this day.</p> : availableSlots.map((slot) => (
                              <button key={slot} onClick={() => handleTimeSelect(slot)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${booking.time === slot ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{formatSlotLabel(slot)}</button>
                            ))}
                          </div>
                          <form onSubmit={handleBookingSubmit} className="space-y-3">
                            <textarea value={booking.notes} onChange={(event) => setBooking((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Add a note for the team" />
                            <button disabled={!canProceed || loading} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-70">{loading ? "Reserving..." : "Confirm appointment & pay"}</button>
                            {!canProceed && bookingRequirementsMessage ? <p className="text-sm text-muted-foreground">{bookingRequirementsMessage}</p> : null}
                          </form>
                        </div>
                      ) : (
                        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Pick a date above to see available times.</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <section aria-labelledby="delete-account-heading" className="rounded-3xl border border-red-200 bg-red-50/50 p-8 shadow-sm">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700">My Account</p>
                    <h3 id="delete-account-heading" className="mt-1 text-2xl font-bold font-serif text-foreground">Delete your account</h3>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      Permanently delete your profile, appointments, and account access. This action cannot be undone.
                    </p>
                  </div>
                  {!deleteAccountOpen ? (
                    <button
                      type="button"
                      onClick={() => { setDeleteAccountOpen(true); setFeedback(null); }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                      Delete your account
                    </button>
                  ) : null}
                </div>

                {deleteAccountOpen ? (
                  <form onSubmit={handleDeleteAccount} className="mt-6 max-w-xl space-y-4 rounded-2xl border border-red-200 bg-white p-5">
                    <p className="text-sm font-semibold text-red-800">Request permanent account deletion</p>
                    <div>
                      <label htmlFor="delete-account-password" className="mb-1.5 block text-sm font-medium text-foreground">Current password</label>
                      <input
                        id="delete-account-password"
                        type="password"
                        autoComplete="current-password"
                        value={deleteAccountForm.currentPassword}
                        onChange={(event) => setDeleteAccountForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="delete-account-confirmation" className="mb-1.5 block text-sm font-medium text-foreground">Type DELETE to confirm</label>
                      <input
                        id="delete-account-confirmation"
                        value={deleteAccountForm.confirmation}
                        onChange={(event) => setDeleteAccountForm((current) => ({ ...current, confirmation: event.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
                        placeholder="DELETE"
                        required
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={loading || deleteAccountForm.confirmation !== "DELETE"}
                        className="rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Sending request..." : "Submit deletion request"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteAccountOpen(false); setDeleteAccountForm({ currentPassword: "", confirmation: "" }); }}
                        className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            </div>
          </section>
        ) : (
          <>
            <section className="min-h-screen grid md:grid-cols-2">
              <div className="bg-[#1B2B1B] flex flex-col justify-center px-10 md:px-16 py-24 order-2 md:order-1">
                <p className="text-[#5A8B60] text-xs font-semibold tracking-[0.2em] uppercase mb-6">Essex, UK</p>
                <h1 className="text-white text-5xl md:text-6xl lg:text-[4.5rem] font-bold font-serif leading-[1.05] mb-8">Expert care for your best friend.</h1>
                <p className="text-[#A8BFA9] text-lg leading-relaxed mb-10 max-w-md">Grooming, training, daycare, and boarding — all under one roof. Sign in, register, and book in minutes.</p>
                <div className="flex flex-wrap gap-4">
                  <button onClick={scrollToBooking} className="bg-primary text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2.5">Book an Appointment <ArrowRight size={18} /></button>
                  <button onClick={() => { setAuthMode("login"); setCurrentView("login"); }} className="text-white/80 px-8 py-4 rounded-xl text-base font-medium border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all">Sign In</button>
                </div>
                <div className="mt-16 flex gap-12">
                  {[{ value: "500+", label: "Happy dogs" }, { value: "5★", label: "Avg rating" }, { value: "4 yrs", label: "In business" }].map((stat) => (
                    <div key={stat.label}>
                      <div className="text-white text-2xl font-bold font-serif">{stat.value}</div>
                      <div className="text-[#6A9B6C] text-sm mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative order-1 md:order-2 min-h-[55vw] md:min-h-0 bg-stone-200 overflow-hidden">
                <img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&h=1100&fit=crop&auto=format" alt="Happy golden retriever" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                <div
                  className="absolute bottom-8 left-8 bg-white rounded-2xl shadow-2xl p-5 max-w-[220px]"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <Check size={15} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Next Appointment</div>
                      <div className="text-sm font-semibold text-foreground">
                        {nextAppointment
                          ? formatNextAppointment(nextAppointment.dateTime)
                          : user
                            ? "No upcoming appointment"
                            : "Sign in to view"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        !nextAppointment
                          ? "bg-stone-300"
                          : nextAppointmentStatus?.label === "Confirmed"
                          ? "bg-emerald-400"
                          : nextAppointmentStatus?.label === "Rescheduled"
                            ? "bg-sky-400"
                            : "bg-amber-400"
                      }`}
                    />
                    {nextAppointmentStatus?.label ??
                      (user ? "Nothing scheduled" : "Your appointment time will appear here")}
                  </div>
                </div>
              </div>
            </section>

            <section id="services" className="py-24 px-6 bg-secondary/50">
              <div className="max-w-6xl mx-auto">
                <div className="mb-14 max-w-xl">
                  <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase mb-4">What we offer</p>
                  <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight">Services designed around your dog</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {SERVICES.map((service) => (
                    <div key={service.id} className="bg-card rounded-2xl p-7 border border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                      <div className={`w-11 h-11 ${service.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                        <service.Icon size={20} className={service.iconColor} />
                      </div>
                      <h3 className="text-lg font-bold font-serif text-foreground mb-1">{service.name}</h3>
                      <p className="text-primary font-semibold text-sm">{service.price}</p>
                      <p className="text-muted-foreground text-xs mb-4">{service.duration}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{service.desc}</p>
                      <button onClick={scrollToBooking} className="mt-6 text-sm font-semibold text-foreground flex items-center gap-1.5 hover:gap-3 transition-all duration-150">Book now <ArrowRight size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="booking" className="py-24 px-6">
              <div className="max-w-6xl mx-auto">
                <div className="mb-14">
                  <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase mb-4">Reserve a spot</p>
                  <h2 className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight mb-3">Book an appointment</h2>
                  <p className="text-muted-foreground text-lg max-w-lg">Create your account, select a service, choose an available date and time, and confirm your appointment. All booking details are securely stored in PostgreSQL to ensure your information is managed safely and reliably.</p>
                </div>
                <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                  {feedback && currentView === "home" ? <div className="mb-6 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">{feedback}</div> : null}
                  {!user ? (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                      <h3 className="text-2xl font-bold font-serif text-foreground">Create an account to book</h3>
                      <p className="mt-3 text-muted-foreground">Sign in or register to access real-time booking and manage your appointments.</p>
                      <div className="mt-6 flex justify-center gap-3">
                        <button onClick={() => { setAuthMode("login"); setCurrentView("login"); }} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Sign In</button>
                        <button onClick={() => { setAuthMode("register"); setCurrentView("register"); }} className="rounded-xl border border-border px-5 py-3 text-sm font-semibold">Register</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-2xl border border-border bg-background p-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Quick booking</p>
                        <h3 className="mt-2 text-2xl font-bold font-serif text-foreground">Your dashboard is ready</h3>
                        <p className="mt-3 text-sm text-muted-foreground">Once you sign in, you can view your upcoming appointments, confirm visits, and reschedule them instantly.</p>
                        <button onClick={() => setCurrentView("dashboard")} className="mt-6 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Open dashboard</button>
                      </div>
                      <div className="rounded-2xl border border-border bg-background p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-foreground">Select a month and date</span>
                          <div className="flex items-center gap-2">
                            <button type="button" aria-label="Previous month" onClick={() => showMonth(subMonths(currentMonth, 1))} className="rounded-lg border border-border p-2"><ChevronLeft size={16} /></button>
                            <select
                              aria-label="Select month"
                              value={currentMonth.getMonth()}
                              onChange={(event) => handleMonthSelect(Number(event.target.value))}
                              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
                            >
                              {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                            </select>
                            <span className="min-w-10 text-center text-sm font-semibold text-foreground">{format(currentMonth, "yyyy")}</span>
                            <button type="button" aria-label="Next month" onClick={() => showMonth(addMonths(currentMonth, 1))} className="rounded-lg border border-border p-2"><ChevronRight size={16} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => <div key={day}>{day}</div>)}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-1">
                          {calDays.map((day, index) => {
                            const inMonth = isSameMonth(day, currentMonth);
                            const disabled = isDateDisabled(day);
                            const selected = selectedDate !== null && isSameDay(day, selectedDate);

                            return (
                              <button key={`${day.toISOString()}-${index}`} onClick={() => inMonth && handleDateClick(day)} disabled={!inMonth || disabled} className={`h-9 rounded-lg text-sm ${selected ? "bg-primary text-primary-foreground" : inMonth && !disabled ? "hover:bg-muted" : "text-muted-foreground/40"}`}>
                                {format(day, "d")}
                              </button>
                            );
                          })}
                        </div>
                        {selectedDate ? (
                          <div className="mt-5">
                            <div className="grid grid-cols-2 gap-2">
                              {availableSlots.length === 0 ? <p className="col-span-2 text-sm text-muted-foreground">No slots available for this day.</p> : availableSlots.map((slot) => (
                                <button key={slot} onClick={() => handleTimeSelect(slot)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${booking.time === slot ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>{formatSlotLabel(slot)}</button>
                              ))}
                            </div>
                            <button onClick={() => setCurrentView("dashboard")} className="mt-4 rounded-xl border border-border px-4 py-3 text-sm font-semibold">Open dashboard to finish booking</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section id="about" className="py-24 px-6 bg-[#1B2B1B]">
              <div className="max-w-6xl mx-auto">
                <div className="mb-14">
                  <p className="text-[#5A8B60] text-xs font-semibold tracking-[0.18em] uppercase mb-4">Real customer feedback</p>
                  <h2 className="text-4xl md:text-5xl font-bold font-serif text-white leading-tight">Reviews from Pawside customers</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#A8BFA9]">Every review shown here was submitted by a registered customer after a completed appointment.</p>
                </div>
                {reviews.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-sm text-[#B8CEB9]">
                    No customer reviews have been submitted yet. Completed appointments will offer customers the option to leave the first review.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reviews.map((review) => (
                      <article key={review.id} className="bg-white/[0.05] border border-white/10 rounded-2xl p-7 flex flex-col hover:bg-white/[0.08] transition-colors">
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} size={13} className={star <= review.rating ? "text-amber-400 fill-amber-400" : "text-white/20"} />
                            ))}
                          </div>
                          <time dateTime={review.createdAt} className="text-[11px] text-[#6A9B6C]">{formatReviewDate(review.createdAt)}</time>
                        </div>
                        <blockquote className="text-[#B8CEB9] text-sm leading-relaxed flex-1 mb-7">“{review.comment}”</blockquote>
                        <div className="flex items-center gap-3">
                          <img src={resolveAvatarUrl(review.avatarUrl)} alt={`${review.customerName}'s profile`} className="w-10 h-10 rounded-full object-cover bg-[#2A3D2A] shrink-0" />
                          <div>
                            <div className="text-white text-sm font-semibold">{review.customerName}</div>
                            <div className="text-[#6A9B6C] text-xs mt-0.5">{review.petName} — {review.petBreed}</div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

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
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">Professional dog grooming, training, daycare, and boarding in Essex, UK.</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-4">Services</h4>
                    <ul className="space-y-2.5">
                      {SERVICES.map((service) => <li key={service.id}><a href="#booking" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{service.name}</a></li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-4">Contact</h4>
                    <ul className="space-y-2.5 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" />Essex, UK</li>
                      <li className="flex items-center gap-2"><Phone size={14} className="shrink-0" />(503) 555-0142</li>
                    </ul>
                  </div>
                </div>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
