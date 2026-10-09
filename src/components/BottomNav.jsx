import { Car, Home, Route, User, Wrench } from "lucide-react";
import { PRODUCTS, VIEWS } from "../data/mockData";

const PROFILE_PATHS = ["/notifications", "/security", "/settings", "/support", "/add-device"];

export default function BottomNav({ product, path, onNavigate }) {
  const third = product === PRODUCTS.LUMINEN
    ? { key: VIEWS.DIAGNOSTICS, label: "دیاگ", icon: Wrench }
    : { key: VIEWS.ROUTES, label: "مسیرها", icon: Route };

  const items = [
    { key: VIEWS.HOME, label: "خانه", icon: Home },
    { key: VIEWS.VEHICLE, label: product === PRODUCTS.NEGAHBAN ? "دستگاه" : "خودرو", icon: Car },
    third,
    { key: VIEWS.PROFILE, label: "پروفایل", icon: User },
  ];

  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      {items.map((item) => {
        const Icon = item.icon;
        const active = path === `/${item.key}`
          || (path.startsWith("/diagnostics/") && item.key === VIEWS.DIAGNOSTICS)
          || (item.key === VIEWS.PROFILE && PROFILE_PATHS.includes(path));
        return (
          <button
            key={item.key}
            type="button"
            className={active ? "nav-active" : ""}
            onClick={() => onNavigate(`/${item.key}`)}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
