import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

const VEHICLE_DATA: Record<string, { logo: string; models: string[] }> = {
  "Abarth": { logo: "https://cdn.simpleicons.org/abarth", models: ["500", "595", "695", "Punto"] },
  "Alfa Romeo": { logo: "https://cdn.simpleicons.org/alfaromeo", models: ["Giulia", "Stelvio", "Tonale", "Giulietta", "MiTo", "4C", "159", "147"] },
  "Aston Martin": { logo: "https://cdn.simpleicons.org/astonmartin", models: ["DB11", "DB12", "Vantage", "DBX", "DBS"] },
  "Audi": { logo: "https://cdn.simpleicons.org/audi", models: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT", "RS3", "RS4", "RS5", "RS6", "RS7", "S3", "S4", "S5"] },
  "Bentley": { logo: "https://cdn.simpleicons.org/bentley", models: ["Continental GT", "Flying Spur", "Bentayga"] },
  "BMW": { logo: "https://cdn.simpleicons.org/bmw", models: ["Série 1", "Série 2", "Série 3", "Série 4", "Série 5", "Série 7", "Série 8", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z4", "M2", "M3", "M4", "M5", "iX", "i4", "i5", "i7", "iX1", "iX3"] },
  "Bugatti": { logo: "https://cdn.simpleicons.org/bugatti", models: ["Chiron", "Veyron", "Divo", "Centodieci"] },
  "BYD": { logo: "https://cdn.simpleicons.org/byd", models: ["Atto 3", "Seal", "Dolphin", "Han", "Tang", "Seagull", "Song Plus", "Yuan Plus"] },
  "Cadillac": { logo: "https://cdn.simpleicons.org/cadillac", models: ["Escalade", "CT5", "XT4", "XT5", "XT6", "Lyriq"] },
  "Chevrolet": { logo: "https://cdn.simpleicons.org/chevrolet", models: ["Camaro", "Corvette", "Malibu", "Tahoe", "Suburban", "Silverado", "Equinox", "Traverse", "Blazer", "Trax"] },
  "Chrysler": { logo: "https://cdn.simpleicons.org/chrysler", models: ["300", "Pacifica", "Voyager"] },
  "Citroën": { logo: "https://cdn.simpleicons.org/citroen", models: ["C1", "C3", "C3 Aircross", "C4", "C4 X", "C5 X", "C5 Aircross", "Berlingo", "SpaceTourer", "ë-C4", "C3 (India)", "eC3", "Basalt"] },
  "Cupra": { logo: "https://cdn.simpleicons.org/cupra", models: ["Born", "Formentor", "Leon", "Ateca", "Tavascan"] },
  "Dacia": { logo: "https://cdn.simpleicons.org/dacia", models: ["Sandero", "Duster", "Jogger", "Spring", "Logan"] },
  "Dodge": { logo: "https://cdn.simpleicons.org/dodge", models: ["Challenger", "Charger", "Durango", "Hornet"] },
  "DS": { logo: "https://cdn.simpleicons.org/ds", models: ["DS 3", "DS 4", "DS 7", "DS 9"] },
  "Ferrari": { logo: "https://cdn.simpleicons.org/ferrari", models: ["296 GTB", "SF90", "Roma", "Purosangue", "812", "F8 Tributo", "Portofino"] },
  "Fiat": { logo: "https://cdn.simpleicons.org/fiat", models: ["500", "500X", "500L", "Panda", "Tipo", "Punto", "600", "Doblo"] },
  "Force Motors": { logo: "https://cdn.simpleicons.org/forcemotors", models: ["Gurkha", "Gurkha 5-Door", "Trax", "Traveller", "Urbania"] },
  "Ford": { logo: "https://cdn.simpleicons.org/ford", models: ["Fiesta", "Focus", "Puma", "Kuga", "Explorer", "Mustang", "Mustang Mach-E", "Transit", "Ranger", "Bronco", "EcoSport", "Galaxy", "S-Max", "Tourneo"] },
  "Genesis": { logo: "https://cdn.simpleicons.org/genesis", models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  "Honda": { logo: "https://cdn.simpleicons.org/honda", models: ["Civic", "Accord", "CR-V", "HR-V", "Jazz", "e:Ny1", "ZR-V", "Civic Type R", "City", "Amaze", "Elevate", "WR-V"] },
  "Hyundai": { logo: "https://cdn.simpleicons.org/hyundai", models: ["i10", "i20", "i30", "Kona", "Tucson", "Santa Fe", "IONIQ 5", "IONIQ 6", "Bayon", "Staria", "Creta", "Venue", "Verna", "Alcazar", "Exter", "Aura", "Grand i10 Nios"] },
  "Infiniti": { logo: "https://cdn.simpleicons.org/infiniti", models: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"] },
  "Jaguar": { logo: "https://cdn.simpleicons.org/jaguar", models: ["F-Pace", "E-Pace", "I-Pace", "XE", "XF", "F-Type"] },
  "Jeep": { logo: "https://cdn.simpleicons.org/jeep", models: ["Wrangler", "Cherokee", "Grand Cherokee", "Compass", "Renegade", "Avenger", "Gladiator", "Meridian"] },
  "Kia": { logo: "https://cdn.simpleicons.org/kia", models: ["Picanto", "Rio", "Ceed", "Proceed", "Sportage", "Sorento", "Niro", "EV6", "EV9", "Stonic", "XCeed", "Stinger", "Seltos", "Carens", "Sonet", "Carnival"] },
  "Lamborghini": { logo: "https://cdn.simpleicons.org/lamborghini", models: ["Huracán", "Urus", "Revuelto"] },
  "Land Rover": { logo: "https://cdn.simpleicons.org/landrover", models: ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Discovery", "Discovery Sport", "Defender"] },
  "Lexus": { logo: "https://cdn.simpleicons.org/lexus", models: ["IS", "ES", "LS", "UX", "NX", "RX", "RZ", "LC", "LX", "GX"] },
  "Lotus": { logo: "https://cdn.simpleicons.org/lotus", models: ["Emira", "Eletre", "Evija"] },
  "Mahindra": { logo: "https://cdn.simpleicons.org/mahindra", models: ["XUV700", "XUV300", "XUV400 EV", "Scorpio-N", "Scorpio Classic", "Thar", "Thar Roxx", "Bolero", "Bolero Neo", "Marazzo", "BE 6", "XEV 9e"] },
  "Maruti Suzuki": { logo: "https://cdn.simpleicons.org/marutisuzuki", models: ["Alto K10", "S-Presso", "Wagon R", "Celerio", "Swift", "Dzire", "Baleno", "Ignis", "Brezza", "Ertiga", "XL6", "Grand Vitara", "Fronx", "Jimny", "Invicto", "Eeco"] },
  "Maserati": { logo: "https://cdn.simpleicons.org/maserati", models: ["Ghibli", "Quattroporte", "Levante", "MC20", "Grecale", "GranTurismo"] },
  "Mazda": { logo: "https://cdn.simpleicons.org/mazda", models: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-60", "MX-5", "MX-30"] },
  "McLaren": { logo: "https://cdn.simpleicons.org/mclaren", models: ["720S", "765LT", "Artura", "GT"] },
  "Mercedes-Benz": { logo: "https://cdn.simpleicons.org/mercedes", models: ["Classe A", "Classe B", "Classe C", "Classe E", "Classe S", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "EQA", "EQB", "EQC", "EQE", "EQS", "AMG GT", "SL", "Maybach S-Class", "G-Class"] },
  "MG": { logo: "https://cdn.simpleicons.org/mg", models: ["Hector", "Hector Plus", "Astor", "Gloster", "ZS EV", "Comet EV", "Windsor EV"] },
  "MINI": { logo: "https://cdn.simpleicons.org/mini", models: ["Cooper", "Cooper S", "Countryman", "Clubman", "John Cooper Works"] },
  "Mitsubishi": { logo: "https://cdn.simpleicons.org/mitsubishi", models: ["ASX", "Eclipse Cross", "Outlander", "Space Star", "L200", "Pajero"] },
  "Nissan": { logo: "https://cdn.simpleicons.org/nissan", models: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf", "Ariya", "Navara", "GT-R", "370Z", "Magnite"] },
  "Opel": { logo: "https://cdn.simpleicons.org/opel", models: ["Corsa", "Astra", "Mokka", "Crossland", "Grandland", "Combo", "Vivaro", "Zafira"] },
  "Peugeot": { logo: "https://cdn.simpleicons.org/peugeot", models: ["208", "308", "408", "508", "2008", "3008", "5008", "Rifter", "Partner", "e-208", "e-2008", "e-308"] },
  "Porsche": { logo: "https://cdn.simpleicons.org/porsche", models: ["911", "718 Cayman", "718 Boxster", "Panamera", "Cayenne", "Macan", "Taycan"] },
  "Renault": { logo: "https://cdn.simpleicons.org/renault", models: ["Clio", "Megane", "Captur", "Kadjar", "Austral", "Arkana", "Scenic", "Twingo", "Zoe", "Megane E-Tech", "Kangoo", "Trafic", "Master", "Kwid", "Triber", "Kiger"] },
  "Rolls-Royce": { logo: "https://cdn.simpleicons.org/rollsroyce", models: ["Ghost", "Phantom", "Wraith", "Dawn", "Cullinan", "Spectre"] },
  "SEAT": { logo: "https://cdn.simpleicons.org/seat", models: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco"] },
  "Škoda": { logo: "https://cdn.simpleicons.org/skoda", models: ["Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Citigo", "Slavia", "Kushaq", "Kylaq"] },
  "Smart": { logo: "https://cdn.simpleicons.org/smart", models: ["Fortwo", "Forfour", "#1", "#3"] },
  "Subaru": { logo: "https://cdn.simpleicons.org/subaru", models: ["Impreza", "XV", "Forester", "Outback", "WRX", "BRZ", "Solterra"] },
  "Suzuki": { logo: "https://cdn.simpleicons.org/suzuki", models: ["Swift", "Vitara", "S-Cross", "Jimny", "Ignis", "Across", "Swace"] },
  "Tata": { logo: "https://cdn.simpleicons.org/tata", models: ["Nexon", "Nexon EV", "Punch", "Punch EV", "Tiago", "Tiago EV", "Tigor", "Tigor EV", "Altroz", "Harrier", "Harrier EV", "Safari", "Curvv", "Curvv EV"] },
  "Tesla": { logo: "https://cdn.simpleicons.org/tesla", models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"] },
  "Toyota": { logo: "https://cdn.simpleicons.org/toyota", models: ["Yaris", "Yaris Cross", "Corolla", "Camry", "C-HR", "RAV4", "Highlander", "Land Cruiser", "Hilux", "Supra", "GR86", "Aygo X", "bZ4X", "Proace", "Innova Crysta", "Innova Hycross", "Fortuner", "Hyryder", "Glanza", "Rumion", "Vellfire"] },
  "VinFast": { logo: "https://cdn.simpleicons.org/vinfast", models: ["VF 3", "VF 5", "VF 6", "VF 7", "VF 8", "VF 9", "VF e34"] },
  "Volkswagen": { logo: "https://cdn.simpleicons.org/volkswagen", models: ["Polo", "Golf", "ID.3", "ID.4", "ID.5", "ID.7", "ID. Buzz", "T-Cross", "T-Roc", "Tiguan", "Touareg", "Passat", "Arteon", "Taigo", "Up!", "Caddy", "Transporter", "Multivan", "Virtus", "Taigun"] },
  "Volvo": { logo: "https://cdn.simpleicons.org/volvo", models: ["XC40", "XC60", "XC90", "S60", "S90", "V60", "V90", "C40", "EX30", "EX90"] },
};

const MAKE_NAMES = Object.keys(VEHICLE_DATA).sort();

interface Props {
  make: string;
  model: string;
  onMakeChange: (make: string) => void;
  onModelChange: (model: string) => void;
}

function LogoImg({ make }: { make: string }) {
  const [err, setErr] = useState(false);
  const data = VEHICLE_DATA[make];
  if (!data || err) {
    return <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{make.charAt(0)}</span>;
  }
  return <img src={data.logo} alt={make} className="w-6 h-6 object-contain" onError={() => setErr(true)} />;
}

function DropdownField({
  label,
  value,
  options,
  onSelect,
  placeholder,
  renderOption,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder: string;
  renderOption: (opt: string) => React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(s));
  }, [options, search]);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <Label>{label} *</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className="absolute z-[100] mt-1 w-full rounded-md border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 max-h-[280px] flex flex-col"
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center border-b px-2 py-1.5">
            <Search className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">—</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onSelect(opt); setOpen(false); setSearch(""); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm cursor-pointer transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    opt === value && "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  {renderOption(opt)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VehicleMakeModelSelector({ make, model, onMakeChange, onModelChange }: Props) {
  const { t } = useLanguage();

  const models = useMemo(() => {
    return VEHICLE_DATA[make]?.models || [];
  }, [make]);

  const handleMakeChange = (newMake: string) => {
    onMakeChange(newMake);
    if (make !== newMake) {
      onModelChange("");
    }
  };

  return (
    <>
      <DropdownField
        label={t('vehicles.make')}
        value={make}
        options={MAKE_NAMES}
        onSelect={handleMakeChange}
        placeholder={t('vehicles.searchMake') || "Pesquisar marca..."}
        renderOption={(opt) => (
          <>
            <LogoImg make={opt} />
            <span>{opt}</span>
          </>
        )}
      />
      <DropdownField
        label={t('vehicles.model')}
        value={model}
        options={models.length > 0 ? models : []}
        onSelect={onModelChange}
        placeholder={models.length > 0 ? (t('vehicles.searchModel') || "Pesquisar modelo...") : (t('vehicles.selectMakeFirst') || "Selecione a marca primeiro")}
        disabled={models.length === 0 && !make}
        renderOption={(opt) => <span>{opt}</span>}
      />
    </>
  );
}
