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
  "Citroën": { logo: "https://cdn.simpleicons.org/citroen", models: ["C1", "C3", "C3 Aircross", "C4", "C4 X", "C5 X", "C5 Aircross", "Berlingo", "SpaceTourer", "ë-C4"] },
  "Cupra": { logo: "https://cdn.simpleicons.org/cupra", models: ["Born", "Formentor", "Leon", "Ateca", "Tavascan"] },
  "Dacia": { logo: "https://cdn.simpleicons.org/dacia", models: ["Sandero", "Duster", "Jogger", "Spring", "Logan"] },
  "Dodge": { logo: "https://cdn.simpleicons.org/dodge", models: ["Challenger", "Charger", "Durango", "Hornet"] },
  "DS": { logo: "https://cdn.simpleicons.org/ds", models: ["DS 3", "DS 4", "DS 7", "DS 9"] },
  "Ferrari": { logo: "https://cdn.simpleicons.org/ferrari", models: ["296 GTB", "SF90", "Roma", "Purosangue", "812", "F8 Tributo", "Portofino"] },
  "Fiat": { logo: "https://cdn.simpleicons.org/fiat", models: ["500", "500X", "500L", "Panda", "Tipo", "Punto", "600", "Doblo"] },
  "Ford": { logo: "https://cdn.simpleicons.org/ford", models: ["Fiesta", "Focus", "Puma", "Kuga", "Explorer", "Mustang", "Mustang Mach-E", "Transit", "Ranger", "Bronco", "EcoSport", "Galaxy", "S-Max", "Tourneo"] },
  "Genesis": { logo: "https://cdn.simpleicons.org/genesis", models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  "Honda": { logo: "https://cdn.simpleicons.org/honda", models: ["Civic", "Accord", "CR-V", "HR-V", "Jazz", "e:Ny1", "ZR-V", "Civic Type R"] },
  "Hyundai": { logo: "https://cdn.simpleicons.org/hyundai", models: ["i10", "i20", "i30", "Kona", "Tucson", "Santa Fe", "IONIQ 5", "IONIQ 6", "Bayon", "Staria"] },
  "Infiniti": { logo: "https://cdn.simpleicons.org/infiniti", models: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"] },
  "Jaguar": { logo: "https://cdn.simpleicons.org/jaguar", models: ["F-Pace", "E-Pace", "I-Pace", "XE", "XF", "F-Type"] },
  "Jeep": { logo: "https://cdn.simpleicons.org/jeep", models: ["Wrangler", "Cherokee", "Grand Cherokee", "Compass", "Renegade", "Avenger", "Gladiator"] },
  "Kia": { logo: "https://cdn.simpleicons.org/kia", models: ["Picanto", "Rio", "Ceed", "Proceed", "Sportage", "Sorento", "Niro", "EV6", "EV9", "Stonic", "XCeed", "Stinger"] },
  "Lamborghini": { logo: "https://cdn.simpleicons.org/lamborghini", models: ["Huracán", "Urus", "Revuelto"] },
  "Land Rover": { logo: "https://cdn.simpleicons.org/landrover", models: ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque", "Discovery", "Discovery Sport", "Defender"] },
  "Lexus": { logo: "https://cdn.simpleicons.org/lexus", models: ["IS", "ES", "LS", "UX", "NX", "RX", "RZ", "LC", "LX", "GX"] },
  "Lotus": { logo: "https://cdn.simpleicons.org/lotus", models: ["Emira", "Eletre", "Evija"] },
  "Maserati": { logo: "https://cdn.simpleicons.org/maserati", models: ["Ghibli", "Quattroporte", "Levante", "MC20", "Grecale", "GranTurismo"] },
  "Mazda": { logo: "https://cdn.simpleicons.org/mazda", models: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-60", "MX-5", "MX-30"] },
  "McLaren": { logo: "https://cdn.simpleicons.org/mclaren", models: ["720S", "765LT", "Artura", "GT"] },
  "Mercedes-Benz": { logo: "https://cdn.simpleicons.org/mercedes", models: ["Classe A", "Classe B", "Classe C", "Classe E", "Classe S", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "EQA", "EQB", "EQC", "EQE", "EQS", "AMG GT", "SL", "G-Class"] },
  "MG": { logo: "https://cdn.simpleicons.org/mg", models: ["ZS EV", "MG4", "MG5", "Marvel R", "HS"] },
  "MINI": { logo: "https://cdn.simpleicons.org/mini", models: ["Cooper", "Cooper S", "Countryman", "Clubman", "John Cooper Works"] },
  "Mitsubishi": { logo: "https://cdn.simpleicons.org/mitsubishi", models: ["ASX", "Eclipse Cross", "Outlander", "Space Star", "L200", "Pajero"] },
  "Nissan": { logo: "https://cdn.simpleicons.org/nissan", models: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf", "Ariya", "Navara", "GT-R", "370Z"] },
  "Opel": { logo: "https://cdn.simpleicons.org/opel", models: ["Corsa", "Astra", "Mokka", "Crossland", "Grandland", "Combo", "Vivaro", "Zafira"] },
  "Peugeot": { logo: "https://cdn.simpleicons.org/peugeot", models: ["208", "308", "408", "508", "2008", "3008", "5008", "Rifter", "Partner", "e-208", "e-2008", "e-308"] },
  "Porsche": { logo: "https://cdn.simpleicons.org/porsche", models: ["911", "718 Cayman", "718 Boxster", "Panamera", "Cayenne", "Macan", "Taycan"] },
  "Renault": { logo: "https://cdn.simpleicons.org/renault", models: ["Clio", "Megane", "Captur", "Kadjar", "Austral", "Arkana", "Scenic", "Twingo", "Zoe", "Megane E-Tech", "Kangoo", "Trafic", "Master"] },
  "Rolls-Royce": { logo: "https://cdn.simpleicons.org/rollsroyce", models: ["Ghost", "Phantom", "Wraith", "Dawn", "Cullinan", "Spectre"] },
  "SEAT": { logo: "https://cdn.simpleicons.org/seat", models: ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco"] },
  "Škoda": { logo: "https://cdn.simpleicons.org/skoda", models: ["Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Citigo"] },
  "Smart": { logo: "https://cdn.simpleicons.org/smart", models: ["Fortwo", "Forfour", "#1", "#3"] },
  "Subaru": { logo: "https://cdn.simpleicons.org/subaru", models: ["Impreza", "XV", "Forester", "Outback", "WRX", "BRZ", "Solterra"] },
  "Suzuki": { logo: "https://cdn.simpleicons.org/suzuki", models: ["Swift", "Vitara", "S-Cross", "Jimny", "Ignis", "Across", "Swace"] },
  "Tesla": { logo: "https://cdn.simpleicons.org/tesla", models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"] },
  "Toyota": { logo: "https://cdn.simpleicons.org/toyota", models: ["Yaris", "Yaris Cross", "Corolla", "C-HR", "RAV4", "Highlander", "Land Cruiser", "Hilux", "Supra", "GR86", "Aygo X", "bZ4X", "Proace"] },
  "Volkswagen": { logo: "https://cdn.simpleicons.org/volkswagen", models: ["Polo", "Golf", "ID.3", "ID.4", "ID.5", "ID.7", "ID. Buzz", "T-Cross", "T-Roc", "Tiguan", "Touareg", "Passat", "Arteon", "Taigo", "Up!", "Caddy", "Transporter", "Multivan"] },
  "Volvo": { logo: "https://cdn.simpleicons.org/volvo", models: ["XC40", "XC60", "XC90", "S60", "S90", "V60", "V90", "C40", "EX30", "EX90"] },
};

// Submodelos/versões comuns em Portugal por "Marca|Modelo"
const SUBMODELS: Record<string, string[]> = {
  // Audi
  "Audi|A3": ["Sportback 30 TFSI", "Sportback 35 TFSI", "Sportback 30 TDI", "Sportback 35 TDI", "Sedan 35 TFSI", "Sedan 35 TDI", "S3", "RS3"],
  "Audi|A4": ["30 TDI", "35 TDI", "40 TDI", "40 TFSI", "45 TFSI", "Avant 35 TDI", "Avant 40 TDI", "S4", "RS4"],
  "Audi|A5": ["Sportback 35 TDI", "Sportback 40 TDI", "Sportback 40 TFSI", "Coupé 40 TFSI", "Cabrio 40 TFSI", "S5", "RS5"],
  "Audi|A6": ["40 TDI", "45 TDI", "50 TDI", "45 TFSI", "55 TFSI e", "Avant 40 TDI", "S6", "RS6 Avant"],
  "Audi|Q2": ["30 TFSI", "35 TFSI", "30 TDI", "35 TDI", "SQ2"],
  "Audi|Q3": ["35 TFSI", "35 TDI", "40 TDI", "45 TFSI e", "Sportback 35 TDI", "RS Q3"],
  "Audi|Q5": ["40 TDI quattro", "45 TFSI quattro", "55 TFSI e quattro", "Sportback 40 TDI", "SQ5"],
  "Audi|Q7": ["45 TDI", "50 TDI", "55 TFSI e", "SQ7"],
  "Audi|Q8": ["50 TDI", "55 TFSI", "60 TFSI e", "SQ8", "RS Q8"],
  "Audi|e-tron": ["50 quattro", "55 quattro", "S", "GT", "RS e-tron GT"],
  // BMW
  "BMW|Série 1": ["116d", "118d", "118i", "120d", "120i", "M135i xDrive"],
  "BMW|Série 2": ["218i Gran Coupé", "220d Gran Coupé", "220i Coupé", "M240i xDrive", "M2"],
  "BMW|Série 3": ["316d", "318d", "318i", "320d", "320d Touring", "320d xDrive", "320i", "320e", "330e", "330i", "330d", "M340i xDrive", "M3", "M3 Touring"],
  "BMW|Série 4": ["420d Coupé", "420d Gran Coupé", "420i", "430d", "430i", "M440i xDrive", "M4"],
  "BMW|Série 5": ["520d", "520d Touring", "520i", "530d", "530e", "540i", "M550i xDrive", "M5"],
  "BMW|Série 7": ["730d", "740d xDrive", "750e xDrive", "M760e xDrive"],
  "BMW|X1": ["sDrive18d", "sDrive18i", "xDrive20d", "xDrive25e", "M35i xDrive"],
  "BMW|X2": ["sDrive18d", "sDrive20i", "xDrive25e", "M35i"],
  "BMW|X3": ["xDrive20d", "xDrive20i", "xDrive30e", "xDrive30d", "M40i", "M40d", "X3 M"],
  "BMW|X4": ["xDrive20d", "xDrive20i", "xDrive30d", "M40i", "M40d"],
  "BMW|X5": ["xDrive30d", "xDrive40d", "xDrive45e", "xDrive50e", "M50d", "M50i", "X5 M"],
  "BMW|X6": ["xDrive30d", "xDrive40d", "M50i", "X6 M"],
  "BMW|X7": ["xDrive40d", "M50i", "M60i xDrive"],
  "BMW|iX": ["xDrive40", "xDrive50", "M60"],
  "BMW|i4": ["eDrive35", "eDrive40", "M50"],
  "BMW|i5": ["eDrive40", "M60 xDrive"],
  // Mercedes
  "Mercedes-Benz|Classe A": ["A 180", "A 180 d", "A 200", "A 200 d", "A 220 d", "A 250 e", "A 35 AMG", "A 45 S AMG", "Sedan A 180 d"],
  "Mercedes-Benz|Classe B": ["B 180", "B 180 d", "B 200 d", "B 220 d", "B 250 e"],
  "Mercedes-Benz|Classe C": ["C 180", "C 200", "C 200 d", "C 220 d", "C 300", "C 300 e", "C 300 d", "Estate C 220 d", "AMG C 43", "AMG C 63 S"],
  "Mercedes-Benz|Classe E": ["E 200", "E 220 d", "E 300 de", "E 300 e", "E 350", "E 400 d 4MATIC", "Estate E 220 d", "AMG E 53", "AMG E 63 S"],
  "Mercedes-Benz|Classe S": ["S 350 d", "S 400 d 4MATIC", "S 450", "S 500", "S 580 e", "AMG S 63 E"],
  "Mercedes-Benz|CLA": ["CLA 180", "CLA 200 d", "CLA 220 d", "CLA 250 e", "AMG CLA 35", "AMG CLA 45 S", "Shooting Brake 200 d"],
  "Mercedes-Benz|GLA": ["GLA 180", "GLA 200 d", "GLA 220 d", "GLA 250 e", "AMG GLA 35", "AMG GLA 45 S"],
  "Mercedes-Benz|GLB": ["GLB 180 d", "GLB 200 d", "GLB 220 d 4MATIC", "AMG GLB 35"],
  "Mercedes-Benz|GLC": ["GLC 200 d", "GLC 220 d 4MATIC", "GLC 300 e 4MATIC", "GLC 300 de 4MATIC", "Coupé GLC 300", "AMG GLC 43", "AMG GLC 63 S"],
  "Mercedes-Benz|GLE": ["GLE 300 d", "GLE 350 de", "GLE 400 d", "GLE 450", "GLE 450 d", "AMG GLE 53", "AMG GLE 63 S"],
  "Mercedes-Benz|EQA": ["EQA 250", "EQA 300 4MATIC", "EQA 350 4MATIC"],
  "Mercedes-Benz|EQB": ["EQB 250", "EQB 300 4MATIC", "EQB 350 4MATIC"],
  "Mercedes-Benz|EQC": ["EQC 400 4MATIC"],
  "Mercedes-Benz|EQE": ["EQE 300", "EQE 350+", "EQE 500 4MATIC", "AMG EQE 43", "AMG EQE 53"],
  // VW
  "Volkswagen|Polo": ["1.0 TSI", "1.0 TSI Life", "1.0 TSI Style", "1.0 TSI R-Line", "GTI"],
  "Volkswagen|Golf": ["1.0 eTSI", "1.5 TSI", "1.5 eTSI", "2.0 TDI", "1.4 eHybrid", "GTI", "GTD", "R", "Variant 2.0 TDI"],
  "Volkswagen|ID.3": ["Pure", "Pro", "Pro S", "Pro Performance", "GTX"],
  "Volkswagen|ID.4": ["Pure", "Pro", "Pro S", "GTX"],
  "Volkswagen|ID.5": ["Pro", "Pro Performance", "GTX"],
  "Volkswagen|T-Cross": ["1.0 TSI", "1.0 TSI Life", "1.0 TSI Style", "1.5 TSI R-Line"],
  "Volkswagen|T-Roc": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "2.0 TSI 4MOTION R-Line", "R", "Cabriolet"],
  "Volkswagen|Tiguan": ["1.5 eTSI", "2.0 TDI", "2.0 TDI 4MOTION", "1.4 eHybrid", "R-Line", "Allspace 2.0 TDI"],
  "Volkswagen|Passat": ["Variant 2.0 TDI", "Variant 1.5 eTSI", "Variant 1.4 eHybrid", "GTE"],
  "Volkswagen|Arteon": ["2.0 TDI", "2.0 TSI 4MOTION R-Line", "Shooting Brake eHybrid", "R"],
  "Volkswagen|Caddy": ["2.0 TDI", "1.5 TSI", "Cargo", "Life", "Style", "Maxi"],
  "Volkswagen|Transporter": ["2.0 TDI T6.1", "T6.1 Kombi", "Multivan 2.0 TDI", "Caravelle"],
  // Renault
  "Renault|Clio": ["SCe 65", "TCe 90", "TCe 100", "TCe 100 GPL", "E-Tech Full Hybrid 145", "dCi 100", "R.S. Line"],
  "Renault|Megane": ["TCe 140", "Blue dCi 115", "E-Tech Plug-in Hybrid 160", "R.S.", "Grandtour dCi"],
  "Renault|Captur": ["TCe 90", "TCe 140", "TCe 100 GPL", "E-Tech Full Hybrid 145", "E-Tech Plug-in Hybrid 160"],
  "Renault|Austral": ["Mild Hybrid 140", "Mild Hybrid Advanced 130", "E-Tech Full Hybrid 200"],
  "Renault|Arkana": ["TCe 140", "E-Tech Full Hybrid 145", "R.S. Line"],
  "Renault|Scenic": ["E-Tech 170", "E-Tech 220 Long Range"],
  "Renault|Kadjar": ["TCe 140", "Blue dCi 115", "Blue dCi 150 4x4"],
  "Renault|Zoe": ["R110", "R135", "Intens", "Iconic"],
  "Renault|Kangoo": ["Blue dCi 95", "TCe 100", "E-Tech Electric", "Combi"],
  "Renault|Trafic": ["Blue dCi 110", "Blue dCi 130", "Blue dCi 170", "Combi", "SpaceClass"],
  "Renault|Master": ["dCi 135", "dCi 165", "L2H2", "L3H2", "L3H3", "E-Tech Electric"],
  // Peugeot
  "Peugeot|208": ["PureTech 75", "PureTech 100", "PureTech 130", "BlueHDi 100", "e-208"],
  "Peugeot|2008": ["PureTech 100", "PureTech 130", "BlueHDi 110", "BlueHDi 130", "e-2008"],
  "Peugeot|308": ["PureTech 130", "BlueHDi 130", "Hybrid 180", "Hybrid 225", "SW BlueHDi", "e-308"],
  "Peugeot|3008": ["PureTech 130", "BlueHDi 130", "Hybrid 136", "Hybrid 180", "Hybrid 225 e-EAT8", "GT"],
  "Peugeot|5008": ["PureTech 130", "BlueHDi 130", "Hybrid 136", "GT"],
  "Peugeot|508": ["PureTech 130", "BlueHDi 130", "Hybrid 180", "Hybrid 225", "SW BlueHDi", "PSE"],
  "Peugeot|Rifter": ["PureTech 110", "BlueHDi 100", "BlueHDi 130", "Long", "e-Rifter"],
  "Peugeot|Partner": ["BlueHDi 75", "BlueHDi 100", "BlueHDi 130", "Long", "e-Partner"],
  // Citroën
  "Citroën|C3": ["PureTech 83", "PureTech 110", "BlueHDi 100", "You!", "Plus", "Max", "ë-C3"],
  "Citroën|C3 Aircross": ["PureTech 110", "PureTech 130", "BlueHDi 110"],
  "Citroën|C4": ["PureTech 100", "PureTech 130", "BlueHDi 130", "ë-C4"],
  "Citroën|C5 Aircross": ["PureTech 130", "BlueHDi 130", "Hybrid 136", "Hybrid 180 e-EAT8"],
  "Citroën|Berlingo": ["PureTech 110", "BlueHDi 100", "BlueHDi 130", "XL", "ë-Berlingo"],
  // Dacia
  "Dacia|Sandero": ["SCe 65", "TCe 90", "TCe 100 ECO-G (GPL)", "Stepway TCe 90", "Stepway TCe 100 GPL"],
  "Dacia|Duster": ["TCe 130", "TCe 130 4x4", "Blue dCi 115", "Blue dCi 115 4x4", "TCe 100 ECO-G", "Hybrid 140"],
  "Dacia|Jogger": ["TCe 110", "TCe 100 ECO-G", "Hybrid 140", "5 lugares", "7 lugares"],
  "Dacia|Spring": ["Essential", "Expression", "Extreme", "Electric 45", "Electric 65"],
  "Dacia|Logan": ["SCe 75", "TCe 90"],
  // Ford
  "Ford|Fiesta": ["1.1 Trend", "1.0 EcoBoost", "1.0 EcoBoost Hybrid", "ST-Line", "ST"],
  "Ford|Focus": ["1.0 EcoBoost Hybrid", "1.5 EcoBlue", "2.3 EcoBoost ST", "Estate 1.0 EcoBoost", "Active"],
  "Ford|Puma": ["1.0 EcoBoost", "1.0 EcoBoost Hybrid", "1.5 EcoBoost ST", "ST-Line"],
  "Ford|Kuga": ["1.5 EcoBoost", "1.5 EcoBlue", "2.5 Full Hybrid", "2.5 PHEV", "ST-Line X"],
  "Ford|Transit": ["Custom 2.0 EcoBlue", "Custom L1H1", "Custom L2H1", "Courier", "Connect", "2.0 EcoBlue L3H2", "E-Transit"],
  "Ford|Ranger": ["2.0 EcoBlue XL", "2.0 EcoBlue Limited", "2.0 EcoBlue Wildtrak", "3.0 V6 Raptor"],
  // Toyota
  "Toyota|Yaris": ["1.0 VVT-i", "1.5 Hybrid", "1.5 Hybrid 130", "GR Sport", "GR Yaris"],
  "Toyota|Yaris Cross": ["1.5 Hybrid", "1.5 Hybrid AWD-i", "GR Sport"],
  "Toyota|Corolla": ["1.8 Hybrid", "2.0 Hybrid", "Touring Sports 1.8 Hybrid", "Touring Sports 2.0 Hybrid", "GR Sport", "Sedan 1.8 Hybrid"],
  "Toyota|C-HR": ["1.8 Hybrid", "2.0 Hybrid", "2.0 Plug-in Hybrid", "GR Sport"],
  "Toyota|RAV4": ["2.5 Hybrid", "2.5 Hybrid AWD-i", "2.5 Plug-in Hybrid AWD-i", "GR Sport"],
  "Toyota|Hilux": ["2.4 D-4D", "2.8 D-4D", "Invincible", "GR Sport"],
  // Hyundai
  "Hyundai|i10": ["1.0", "1.2", "N Line"],
  "Hyundai|i20": ["1.0 T-GDi", "1.0 T-GDi Hybrid", "N Line", "N"],
  "Hyundai|i30": ["1.0 T-GDi", "1.5 T-GDi Hybrid", "1.6 CRDi", "Fastback", "N Line", "N"],
  "Hyundai|Kona": ["1.0 T-GDi", "1.6 T-GDi Hybrid", "1.6 T-GDi Plug-in Hybrid", "Electric 39 kWh", "Electric 64 kWh", "N Line"],
  "Hyundai|Tucson": ["1.6 T-GDi", "1.6 T-GDi Hybrid", "1.6 T-GDi PHEV", "1.6 CRDi", "N Line"],
  "Hyundai|Santa Fe": ["1.6 T-GDi Hybrid", "1.6 T-GDi PHEV", "2.2 CRDi"],
  "Hyundai|IONIQ 5": ["58 kWh RWD", "77 kWh RWD", "77 kWh AWD", "N"],
  "Hyundai|IONIQ 6": ["53 kWh", "77 kWh RWD", "77 kWh AWD"],
  // Kia
  "Kia|Picanto": ["1.0 MPi", "1.2 MPi", "GT-Line"],
  "Kia|Rio": ["1.0 T-GDi", "1.2 MPi", "1.0 T-GDi Hybrid", "GT-Line"],
  "Kia|Ceed": ["1.0 T-GDi", "1.5 T-GDi", "1.6 CRDi", "SW", "ProCeed", "GT"],
  "Kia|Sportage": ["1.6 T-GDi", "1.6 T-GDi Hybrid", "1.6 T-GDi PHEV", "1.6 CRDi", "GT-Line"],
  "Kia|Sorento": ["1.6 T-GDi Hybrid", "1.6 T-GDi PHEV", "2.2 CRDi"],
  "Kia|Niro": ["1.6 GDi Hybrid", "1.6 GDi PHEV", "EV"],
  "Kia|EV6": ["58 kWh RWD", "77 kWh RWD", "77 kWh AWD", "GT-Line", "GT"],
  "Kia|Stonic": ["1.0 T-GDi", "1.0 T-GDi Hybrid", "GT-Line"],
  // Nissan
  "Nissan|Micra": ["IG-T 92", "DIG-T 117", "N-Sport"],
  "Nissan|Juke": ["DIG-T 114", "Hybrid 143", "N-Design", "N-Connecta"],
  "Nissan|Qashqai": ["Mild Hybrid 140", "Mild Hybrid 158", "e-Power", "N-Connecta", "Tekna+"],
  "Nissan|X-Trail": ["Mild Hybrid 163", "e-Power", "e-Power e-4ORCE", "N-Connecta", "Tekna+"],
  "Nissan|Leaf": ["40 kWh", "62 kWh e+", "N-Connecta", "Tekna"],
  "Nissan|Ariya": ["63 kWh", "87 kWh Evolve", "87 kWh e-4ORCE"],
  // Opel
  "Opel|Corsa": ["1.2", "1.2 Turbo", "1.5 Diesel", "Corsa-e", "GS Line"],
  "Opel|Astra": ["1.2 Turbo", "1.5 Diesel", "Hybrid 180", "Hybrid 225", "Sports Tourer", "Astra-e", "GSe"],
  "Opel|Mokka": ["1.2 Turbo", "1.5 Diesel", "Mokka-e", "GS Line"],
  "Opel|Grandland": ["1.2 Turbo", "1.5 Diesel", "Hybrid 136", "Hybrid4 300", "GSe"],
  "Opel|Combo": ["1.5 Diesel", "1.2 Turbo", "Life", "Cargo", "Combo-e", "XL"],
  // SEAT / Cupra
  "SEAT|Ibiza": ["1.0 MPI", "1.0 TSI", "1.5 TSI EVO", "FR", "Xcellence"],
  "SEAT|Leon": ["1.0 eTSI", "1.5 TSI", "2.0 TDI", "1.4 e-Hybrid", "FR", "Sportstourer 2.0 TDI"],
  "SEAT|Arona": ["1.0 TSI", "1.5 TSI EVO", "FR", "Xcellence"],
  "SEAT|Ateca": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "2.0 TDI 4Drive", "FR"],
  "SEAT|Tarraco": ["1.5 TSI", "2.0 TDI", "2.0 TDI 4Drive", "1.4 e-Hybrid", "FR"],
  "Cupra|Born": ["58 kWh", "77 kWh", "77 kWh e-Boost", "VZ"],
  "Cupra|Formentor": ["1.5 TSI", "2.0 TSI 4Drive", "1.4 e-Hybrid", "2.0 TSI VZ"],
  "Cupra|Leon": ["1.5 TSI", "2.0 TSI", "1.4 e-Hybrid", "Sportstourer 1.4 e-Hybrid", "VZ"],
  "Cupra|Ateca": ["2.0 TSI 4Drive VZ"],
  // Škoda
  "Škoda|Fabia": ["1.0 MPI", "1.0 TSI", "1.5 TSI", "Monte Carlo"],
  "Škoda|Scala": ["1.0 TSI", "1.5 TSI", "Monte Carlo"],
  "Škoda|Octavia": ["1.0 TSI e-TEC", "1.5 TSI e-TEC", "2.0 TDI", "1.4 iV PHEV", "Combi 2.0 TDI", "RS", "RS iV"],
  "Škoda|Superb": ["1.5 TSI", "2.0 TDI", "2.0 TDI 4x4", "iV PHEV", "Combi 2.0 TDI", "Combi iV"],
  "Škoda|Kamiq": ["1.0 TSI", "1.5 TSI", "Monte Carlo"],
  "Škoda|Karoq": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "2.0 TDI 4x4", "Sportline"],
  "Škoda|Kodiaq": ["1.5 TSI", "2.0 TDI", "2.0 TDI 4x4", "iV PHEV", "RS"],
  "Škoda|Enyaq": ["60", "80", "80x", "Coupé iV 80", "RS"],
  // Volvo
  "Volvo|XC40": ["B3", "B4", "T5 Recharge", "Recharge Twin", "Recharge Pure Electric"],
  "Volvo|XC60": ["B4 Diesel", "B4 Petrol", "B5", "T6 Recharge", "T8 Recharge", "Polestar Engineered"],
  "Volvo|XC90": ["B5 Diesel", "B5 Petrol", "B6", "T8 Recharge"],
  "Volvo|S60": ["B3", "B4", "T8 Recharge"],
  "Volvo|S90": ["B5", "B6", "T8 Recharge"],
  "Volvo|V60": ["B3", "B4", "Cross Country B5", "T6 Recharge", "T8 Recharge"],
  "Volvo|V90": ["B5", "Cross Country B5", "T8 Recharge"],
  "Volvo|C40": ["Recharge Pure Electric", "Recharge Twin"],
  "Volvo|EX30": ["Single Motor", "Twin Motor Performance"],
  // MINI
  "MINI|Cooper": ["One", "Cooper", "Cooper D", "Cooper S", "3 Portas", "5 Portas", "Cabrio", "Cooper SE Electric"],
  "MINI|Countryman": ["One", "Cooper", "Cooper D", "Cooper S ALL4", "Cooper SE ALL4", "John Cooper Works ALL4"],
  // Mazda
  "Mazda|Mazda2": ["1.5 SkyActiv-G", "1.5 e-SkyActiv-G Hybrid"],
  "Mazda|Mazda3": ["2.0 e-SkyActiv-G", "2.0 e-SkyActiv-X", "Sedan"],
  "Mazda|CX-3": ["2.0 SkyActiv-G"],
  "Mazda|CX-30": ["2.0 e-SkyActiv-G", "2.0 e-SkyActiv-X"],
  "Mazda|CX-5": ["2.0 e-SkyActiv-G", "2.2 SkyActiv-D", "2.5 e-SkyActiv-G AWD"],
  "Mazda|CX-60": ["e-SkyActiv PHEV", "3.3 e-SkyActiv D 200", "3.3 e-SkyActiv D 254 AWD"],
  "Mazda|MX-5": ["1.5 SkyActiv-G", "2.0 SkyActiv-G", "RF"],
  "Mazda|MX-30": ["e-SkyActiv EV", "R-EV Plug-in Hybrid"],
  // Honda
  "Honda|Civic": ["1.5 VTEC Turbo", "2.0 e:HEV Hybrid", "Type R"],
  "Honda|Jazz": ["1.5 e:HEV", "Crosstar 1.5 e:HEV"],
  "Honda|HR-V": ["1.5 e:HEV"],
  "Honda|CR-V": ["2.0 e:HEV", "2.0 e:PHEV"],
  // Tesla
  "Tesla|Model 3": ["RWD", "Long Range AWD", "Performance"],
  "Tesla|Model Y": ["RWD", "Long Range AWD", "Performance"],
  "Tesla|Model S": ["Dual Motor", "Plaid"],
  "Tesla|Model X": ["Dual Motor", "Plaid"],
  // Land Rover / Jaguar
  "Land Rover|Defender": ["90 D200", "90 D250", "110 D250", "110 D300", "110 P400e PHEV", "130 D300"],
  "Land Rover|Discovery Sport": ["D165", "D200", "P250", "P300e PHEV"],
  "Land Rover|Range Rover Evoque": ["D165", "D200", "P200", "P300e PHEV"],
  "Land Rover|Range Rover Velar": ["D200", "D300", "P400e PHEV"],
  "Land Rover|Range Rover Sport": ["D250", "D300", "D350", "P440e PHEV", "P510e PHEV", "SV"],
  "Land Rover|Range Rover": ["D250", "D300", "D350", "P440e PHEV", "P510e PHEV", "SV"],
  "Jaguar|F-Pace": ["D200", "D300", "P400e PHEV", "SVR"],
  "Jaguar|E-Pace": ["D165", "D200", "P200", "P300e PHEV"],
  "Jaguar|I-Pace": ["EV400 S", "EV400 SE", "EV400 HSE"],
  "Jaguar|XE": ["D200", "P250", "P300"],
  "Jaguar|XF": ["D200", "P250 Sportbrake", "P300"],
  // Porsche
  "Porsche|911": ["Carrera", "Carrera S", "Carrera 4 GTS", "Turbo", "Turbo S", "GT3", "GT3 RS", "Targa 4"],
  "Porsche|Cayenne": ["V6", "S", "S E-Hybrid", "GTS", "Turbo E-Hybrid", "Coupé"],
  "Porsche|Macan": ["Macan", "Macan T", "Macan S", "Macan GTS", "Macan Electric", "Macan Turbo Electric"],
  "Porsche|Taycan": ["Taycan", "4S", "GTS", "Turbo", "Turbo S", "Cross Turismo", "Sport Turismo"],
  "Porsche|Panamera": ["Panamera", "4", "4 E-Hybrid", "GTS", "Turbo E-Hybrid", "Sport Turismo"],
  // Fiat
  "Fiat|500": ["1.0 Hybrid", "500e 24 kWh", "500e 42 kWh", "Cabrio", "Abarth"],
  "Fiat|500X": ["1.5 Hybrid", "1.3 Multijet", "Cross", "Sport"],
  "Fiat|Panda": ["1.0 Hybrid", "Cross 1.0 Hybrid", "4x4"],
  "Fiat|Tipo": ["1.0", "1.6 Multijet", "Cross", "Station Wagon"],
  "Fiat|600": ["Hybrid 100", "600e Electric"],
  "Fiat|Doblo": ["1.5 BlueHDi 100", "1.5 BlueHDi 130", "e-Doblò"],
  // DS
  "DS|DS 3": ["PureTech 100", "PureTech 130", "BlueHDi 130", "E-Tense"],
  "DS|DS 4": ["PureTech 130", "BlueHDi 130", "E-Tense 225"],
  "DS|DS 7": ["BlueHDi 130", "PureTech 130", "E-Tense 225", "E-Tense 300 4x4"],
  // Suzuki
  "Suzuki|Swift": ["1.2 Dualjet Hybrid", "Sport 1.4 Boosterjet Hybrid"],
  "Suzuki|Vitara": ["1.4 Boosterjet Hybrid", "1.5 Full Hybrid", "AllGrip"],
  "Suzuki|S-Cross": ["1.4 Boosterjet Hybrid", "1.5 Full Hybrid AllGrip"],
  "Suzuki|Jimny": ["1.5 Comercial", "Pro"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Extensão do catálogo (PT + BR + ES). Aditiva: nunca remove marcas, modelos
// ou submodelos já existentes; duplicados são eliminados na fusão.
// ─────────────────────────────────────────────────────────────────────────────
const EXTRA_MAKES: Record<string, { logo: string; models: string[] }> = {
  "Chery": { logo: "https://cdn.simpleicons.org/chery", models: ["Tiggo 2", "Tiggo 3X", "Tiggo 5X", "Tiggo 7 Pro", "Tiggo 8 Pro", "Arrizo 6", "Omoda 5"] },
  "GWM": { logo: "https://cdn.simpleicons.org/greatwallmotors", models: ["Haval H6", "Haval Jolion", "Ora 03", "Poer", "Tank 300"] },
  "JAC": { logo: "https://cdn.simpleicons.org/jac", models: ["T40", "T60", "T80", "iEV40", "E-JS1"] },
  "RAM": { logo: "https://cdn.simpleicons.org/ram", models: ["1500", "2500", "3500", "Rampage", "700"] },
  "Iveco": { logo: "https://cdn.simpleicons.org/iveco", models: ["Daily", "Eurocargo", "Stralis", "S-Way"] },
  "SsangYong": { logo: "https://cdn.simpleicons.org/ssangyong", models: ["Tivoli", "Korando", "Rexton", "Musso", "Torres"] },
  "Isuzu": { logo: "https://cdn.simpleicons.org/isuzu", models: ["D-Max", "MU-X", "N-Series"] },
  "Caoa Chery": { logo: "https://cdn.simpleicons.org/chery", models: ["Tiggo 5X", "Tiggo 7", "Tiggo 8", "Arrizo 6"] },
};

// Modelos adicionais para marcas já existentes.
const EXTRA_MODELS: Record<string, string[]> = {
  "Volkswagen": ["Gol", "Voyage", "Saveiro", "Virtus", "Nivus", "Amarok", "Fox", "Jetta", "Polo Track", "T-Cross Highline", "Crafter", "Touran", "Sharan", "Scirocco", "Beetle"],
  "Chevrolet": ["Onix", "Onix Plus", "Prisma", "Tracker", "Spin", "Montana", "S10", "Cruze", "Joy", "Cobalt", "Celta", "Captiva"],
  "Fiat": ["Uno", "Argo", "Cronos", "Mobi", "Strada", "Toro", "Fiorino", "Pulse", "Fastback", "Ducato", "Scudo", "Talento", "Freemont", "Bravo", "Idea", "Palio", "Siena"],
  "Renault": ["Kwid", "Sandero Stepway", "Logan", "Oroch", "Duster Oroch", "Symbol", "Fluence", "Laguna", "Koleos", "Espace", "Grand Scenic", "Rafale"],
  "Ford": ["Ka", "Ka+", "Fusion", "Territory", "Maverick", "F-150", "Edge", "Transit Custom", "Transit Connect", "C-Max", "Mondeo"],
  "Toyota": ["Corolla Cross", "Etios", "SW4", "Yaris Sedan", "Prius", "Avensis", "Auris", "Verso", "Camry", "Land Cruiser Prado"],
  "Honda": ["Fit", "City", "WR-V", "CR-V Hybrid", "Civic Si", "Insight"],
  "Hyundai": ["HB20", "HB20S", "Creta", "Elantra", "ix20", "ix35", "i40", "Accent", "Getz", "Palisade"],
  "Nissan": ["Kicks", "Versa", "March", "Frontier", "Sentra", "Note", "Pulsar", "Primastar"],
  "Peugeot": ["206", "207", "306", "307", "406", "407", "607", "1007", "Boxer", "Expert", "Traveller", "Landtrek"],
  "Citroën": ["C2", "C3 Picasso", "C4 Cactus", "C4 Picasso", "C4 SpaceTourer", "C5", "C8", "Xsara", "Saxo", "Jumper", "Jumpy", "Aircross"],
  "SEAT": ["Alhambra", "Toledo", "Mii", "Altea", "Exeo", "Córdoba"],
  "Opel": ["Meriva", "Insignia", "Adam", "Karl", "Antara", "Movano", "Agila", "Frontera"],
  "Mercedes-Benz": ["Sprinter", "Vito", "Citan", "Classe V", "Classe X", "GLK", "SLK", "CLK", "Classe R"],
  "BMW": ["Série 6", "X8", "i3", "i8", "Série 3 GT", "Série 5 GT"],
  "Audi": ["A2", "Q4 e-tron", "Q6 e-tron", "A3 Sportback e-tron", "S6", "S7", "S8", "RS Q3"],
  "Kia": ["Cerato", "Soul", "Carens", "Carnival", "Venga", "Sportage Hybrid", "Optima", "K5"],
  "Mazda": ["CX-7", "CX-9", "BT-50", "Mazda5", "RX-8"],
  "Mitsubishi": ["Lancer", "Colt", "Montero", "Triton", "Eclipse", "Grandis"],
  "Suzuki": ["Alto", "Baleno", "Celerio", "SX4", "Grand Vitara"],
  "Škoda": { models: [] } as never as string[],
  "Dacia": ["Lodgy", "Dokker", "Sandero Stepway", "Duster Pick-up", "Bigster"],
  "Jeep": ["Commander", "Patriot", "Wagoneer"],
  "Land Rover": ["Freelander", "Range Rover Sport SVR", "Defender 110"],
  "Volvo": ["V40", "S40", "V50", "XC70", "EX40", "EC40"],
  "MG": ["MG3", "ZS", "MG5 SW", "Marvel R Electric", "MG ZS Hybrid+"],
  "BYD": ["Song Pro", "Dolphin Mini", "King", "Shark", "Sealion 7"],
  "Tesla": ["Roadster", "Model 3 Performance"],
  "Alfa Romeo": ["Junior", "Brera", "GT", "166"],
  "MINI": ["Cabrio", "Aceman", "Countryman Electric"],
  "Lexus": ["CT", "NX Hybrid", "RX Hybrid"],
};

// Submodelos/versões adicionais — sempre por "Marca|Modelo".
const EXTRA_SUBMODELS: Record<string, string[]> = {
  // ── Portugal / Espanha ─────────────────────────────────────────────
  "Volkswagen|Golf": ["1.0 TSI", "1.5 TSI", "1.5 eTSI", "2.0 TDI", "GTI", "GTD", "GTE", "R", "Variant 2.0 TDI"],
  "Volkswagen|Polo": ["1.0 MPI", "1.0 TSI", "1.6 TDI", "GTI", "Life", "Style", "R-Line"],
  "Volkswagen|Passat": ["1.5 TSI", "2.0 TDI", "2.0 TDI SCR", "GTE", "Variant 2.0 TDI", "Alltrack"],
  "Volkswagen|T-Roc": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "R-Line", "Cabriolet"],
  "Volkswagen|Tiguan": ["1.5 TSI", "2.0 TDI", "2.0 TDI 4Motion", "eHybrid", "Allspace"],
  "Volkswagen|Transporter": ["T6.1 2.0 TDI", "Kombi", "Caravelle", "California"],
  "Volkswagen|Crafter": ["2.0 TDI L3H2", "2.0 TDI L4H3", "e-Crafter"],
  "Renault|Clio": ["1.0 SCe", "1.0 TCe", "1.5 dCi", "1.5 Blue dCi", "E-Tech Hybrid", "R.S. Line"],
  "Renault|Megane": ["1.3 TCe", "1.5 Blue dCi", "E-Tech Plug-in", "Sport Tourer dCi", "R.S."],
  "Renault|Captur": ["1.0 TCe", "1.3 TCe", "1.5 Blue dCi", "E-Tech Full Hybrid"],
  "Renault|Kangoo": ["1.5 Blue dCi", "Express", "E-Tech Electric"],
  "Renault|Trafic": ["2.0 dCi L1H1", "2.0 dCi L2H1", "Combi"],
  "Renault|Master": ["2.3 dCi L2H2", "2.3 dCi L3H2", "Chassis Cabina"],
  "Peugeot|208": ["1.2 PureTech", "1.5 BlueHDi", "GT Line", "e-208 50 kWh"],
  "Peugeot|308": ["1.2 PureTech", "1.5 BlueHDi", "1.6 Hybrid 180", "SW BlueHDi", "GT"],
  "Peugeot|3008": ["1.2 PureTech", "1.5 BlueHDi", "2.0 BlueHDi", "Hybrid 225", "GT Line"],
  "Peugeot|Partner": ["1.5 BlueHDi L1", "1.5 BlueHDi L2", "e-Partner"],
  "Peugeot|Boxer": ["2.2 BlueHDi L2H2", "2.2 BlueHDi L3H2", "Chassis Cabine"],
  "Citroën|C3": ["1.2 PureTech", "1.5 BlueHDi", "Feel", "Shine", "ë-C3"],
  "Citroën|C4": ["1.2 PureTech", "1.5 BlueHDi", "Feel Pack", "Shine", "ë-C4 50 kWh"],
  "Citroën|Berlingo": ["1.5 BlueHDi M", "1.5 BlueHDi XL", "ë-Berlingo"],
  "Citroën|Jumper": ["2.2 BlueHDi L2H2", "2.2 BlueHDi L3H2"],
  "Opel|Corsa": ["1.2", "1.2 Turbo", "1.5 D", "Corsa-e", "GS Line"],
  "Opel|Astra": ["1.2 Turbo", "1.5 D", "Hybrid 180", "Sports Tourer"],
  "Opel|Combo": ["1.5 D L1H1", "1.5 D L2H1", "Combo-e"],
  "Opel|Vivaro": ["1.5 D L2H1", "2.0 D L3H1", "Vivaro-e"],
  "Ford|Fiesta": ["1.0 EcoBoost", "1.1 Ti-VCT", "1.5 TDCi", "ST-Line", "ST"],
  "Ford|Focus": ["1.0 EcoBoost", "1.5 EcoBlue", "2.0 EcoBlue", "SW EcoBlue", "ST"],
  "Ford|Kuga": ["1.5 EcoBoost", "2.0 EcoBlue", "2.5 PHEV", "ST-Line"],
  "Ford|Transit": ["2.0 EcoBlue L2H2", "2.0 EcoBlue L3H2", "Chassis Cabine", "E-Transit"],
  "Ford|Transit Custom": ["2.0 EcoBlue 130cv", "2.0 EcoBlue 170cv", "Trail", "Sport"],
  "Ford|Ranger": ["2.0 EcoBlue XL", "2.0 EcoBlue Limited", "Wildtrak", "Raptor"],
  "SEAT|Ibiza": ["1.0 MPI", "1.0 TSI", "1.6 TDI", "FR", "Xcellence"],
  "SEAT|Leon": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "e-Hybrid", "FR Sportstourer"],
  "SEAT|Arona": ["1.0 TSI", "1.6 TDI", "FR", "Xperience"],
  "SEAT|Ateca": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "2.0 TDI 4Drive", "FR"],
  "Škoda|Octavia": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "Combi 2.0 TDI", "RS", "iV"],
  "Škoda|Fabia": ["1.0 MPI", "1.0 TSI", "Monte Carlo", "Style"],
  "Škoda|Superb": ["1.5 TSI", "2.0 TDI", "Combi 2.0 TDI", "iV", "L&K"],
  "Škoda|Karoq": ["1.0 TSI", "1.5 TSI", "2.0 TDI", "2.0 TDI 4x4", "Sportline"],
  "Škoda|Kodiaq": ["1.5 TSI", "2.0 TDI", "2.0 TDI 4x4", "RS", "7 lugares"],
  "Dacia|Sandero": ["1.0 SCe", "1.0 TCe", "1.0 ECO-G", "Stepway TCe"],
  "Dacia|Duster": ["1.0 TCe", "1.3 TCe", "1.5 Blue dCi", "1.5 Blue dCi 4x4", "ECO-G"],
  "Toyota|Yaris": ["1.0 VVT-i", "1.5 Hybrid", "1.5 Hybrid GR Sport", "GR Yaris"],
  "Toyota|Corolla": ["1.8 Hybrid", "2.0 Hybrid", "Touring Sports 1.8 Hybrid", "Sedan 1.8 Hybrid", "GR Sport"],
  "Toyota|RAV4": ["2.5 Hybrid", "2.5 Plug-in Hybrid", "AWD-i", "GR Sport"],
  "Toyota|Hilux": ["2.4 D-4D Cabina Dupla", "2.8 D-4D Invincible", "Cabina Simples"],
  "Toyota|Proace": ["1.5 D-4D L1", "2.0 D-4D L2", "Proace City", "Verso"],
  "Nissan|Qashqai": ["1.3 DIG-T", "1.5 dCi", "e-Power", "Tekna"],
  "Nissan|X-Trail": ["1.5 e-Power", "1.6 dCi", "7 lugares"],
  "Hyundai|i30": ["1.0 T-GDi", "1.5 T-GDi", "1.6 CRDi", "SW 1.6 CRDi", "N"],
  "Hyundai|Tucson": ["1.6 T-GDi", "1.6 CRDi", "1.6 T-GDi Hybrid", "PHEV"],
  "Kia|Ceed": ["1.0 T-GDi", "1.5 T-GDi", "1.6 CRDi", "SW 1.6 CRDi", "GT-Line"],
  "Kia|Sportage": ["1.6 T-GDi", "1.6 CRDi", "1.6 T-GDi HEV", "PHEV"],
  "Mercedes-Benz|Sprinter": ["311 CDI L2H2", "314 CDI L3H2", "316 CDI", "eSprinter"],
  "Mercedes-Benz|Vito": ["110 CDI", "114 CDI", "116 CDI", "Tourer", "eVito"],
  "Fiat|Ducato": ["2.2 MultiJet L2H2", "2.2 MultiJet L3H2", "Chassis Cabine", "E-Ducato"],
  "Fiat|500": ["1.0 Hybrid", "1.2", "500e 42 kWh", "Cabrio", "Abarth 595"],
  "Fiat|Panda": ["1.0 Hybrid", "1.2", "4x4", "Cross"],
  "Iveco|Daily": ["35S14 L2H2", "35S16 L3H2", "50C15", "eDaily"],
  // ── Brasil ─────────────────────────────────────────────────────────
  "Volkswagen|Gol": ["1.0 MPI", "1.0 TSI", "1.6 MSI", "Trendline", "Highline"],
  "Volkswagen|Saveiro": ["1.6 Robust", "1.6 Trendline", "Cross CD"],
  "Volkswagen|Virtus": ["1.0 TSI", "1.4 TSI", "Comfortline", "Highline", "GTS"],
  "Volkswagen|Nivus": ["1.0 TSI Comfortline", "1.0 TSI Highline", "Outfit"],
  "Volkswagen|Amarok": ["2.0 TDI CD 4x4", "3.0 V6 Highline", "Extreme"],
  "Chevrolet|Onix": ["1.0 MPI", "1.0 Turbo", "LT", "LTZ", "Premier", "RS"],
  "Chevrolet|Tracker": ["1.0 Turbo LT", "1.2 Turbo Premier", "RS"],
  "Chevrolet|S10": ["2.8 CTDi LS 4x4", "2.8 CTDi LTZ", "High Country"],
  "Chevrolet|Montana": ["1.2 Turbo LT", "1.2 Turbo Premier"],
  "Chevrolet|Spin": ["1.8 LT", "1.8 Premier", "Activ 7 lugares"],
  "Fiat|Strada": ["1.3 Endurance CS", "1.3 Freedom CD", "1.0 Turbo Volcano", "Ranch"],
  "Fiat|Toro": ["1.3 Turbo Endurance", "2.0 Diesel Freedom 4x4", "Volcano", "Ultra"],
  "Fiat|Argo": ["1.0 Firefly Drive", "1.3 Drive", "Trekking"],
  "Fiat|Mobi": ["1.0 Like", "1.0 Trekking"],
  "Fiat|Cronos": ["1.0 Drive", "1.3 Drive", "Precision"],
  "Fiat|Pulse": ["1.3 Drive", "1.0 Turbo Audace", "Impetus", "Abarth"],
  "Fiat|Fastback": ["1.0 Turbo Audace", "1.3 Turbo Impetus", "Abarth"],
  "Renault|Kwid": ["1.0 Zen", "1.0 Intense", "Outsider", "E-Tech"],
  "Renault|Oroch": ["1.3 Turbo Intense", "1.6 Dynamique"],
  "Hyundai|HB20": ["1.0 Sense", "1.0 Turbo Comfort", "1.0 Turbo Platinum"],
  "Hyundai|Creta": ["1.0 Turbo Comfort", "1.6 Action", "2.0 Ultimate", "N Line"],
  "Toyota|Corolla Cross": ["1.8 Hybrid XR", "1.8 Hybrid XRE", "2.0 XRE", "GR-Sport"],
  "Toyota|SW4": ["2.8 D-4D SRX 4x4", "2.8 D-4D Diamond", "7 lugares"],
  "Honda|City": ["1.5 EX", "1.5 EXL", "1.5 Touring", "Hatch"],
  "Honda|WR-V": ["1.5 EX", "1.5 EXL"],
  "Nissan|Kicks": ["1.6 Sense", "1.6 Advance", "1.6 Exclusive", "Play"],
  "Nissan|Frontier": ["2.3 Bi-Turbo Attack 4x4", "2.3 Bi-Turbo Pro-4X"],
  "Jeep|Compass": ["1.3 Turbo Longitude", "2.0 Diesel Limited 4x4", "Série S", "Trailhawk"],
  "Jeep|Renegade": ["1.3 Turbo Longitude", "1.8 Sport", "2.0 Diesel Trailhawk"],
  "Jeep|Commander": ["1.3 Turbo Limited", "2.0 Diesel Overland 4x4"],
  "RAM|Rampage": ["2.0 Turbodiesel Rebel", "2.0 Turbodiesel Laramie", "R/T"],
  "RAM|2500": ["6.7 Cummins Laramie", "Limited"],
  "Chery|Tiggo 8 Pro": ["1.6 TGDI", "2.0 TGDI 7 lugares"],
  "GWM|Haval H6": ["1.5 HEV", "2.0 PHEV19", "2.0 PHEV34"],
};

// Fusão aditiva (sem duplicados, sem remover nada do catálogo original).
Object.entries(EXTRA_MAKES).forEach(([mk, data]) => {
  if (!VEHICLE_DATA[mk]) VEHICLE_DATA[mk] = { logo: data.logo, models: [...data.models] };
  else VEHICLE_DATA[mk].models = Array.from(new Set([...VEHICLE_DATA[mk].models, ...data.models]));
});
Object.entries(EXTRA_MODELS).forEach(([mk, list]) => {
  const entry = VEHICLE_DATA[mk];
  if (!entry || !Array.isArray(list)) return;
  entry.models = Array.from(new Set([...entry.models, ...list]));
});
Object.entries(EXTRA_SUBMODELS).forEach(([key, list]) => {
  SUBMODELS[key] = Array.from(new Set([...(SUBMODELS[key] || []), ...list]));
});

const MAKE_NAMES = Object.keys(VEHICLE_DATA).sort();

interface Props {
  make: string;
  model: string;
  variant?: string;
  onMakeChange: (make: string) => void;
  onModelChange: (model: string) => void;
  onVariantChange?: (variant: string) => void;
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
  allowCustom,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder: string;
  renderOption: (opt: string) => React.ReactNode;
  disabled?: boolean;
  allowCustom?: boolean;
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

  const showCustomOption = allowCustom && search.trim() && !filtered.some(o => o.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <Label>{label}</Label>
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
            {filtered.length === 0 && !showCustomOption ? (
              <p className="text-center text-sm text-muted-foreground py-4">—</p>
            ) : (
              <>
                {filtered.map(opt => (
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
                ))}
                {showCustomOption && (
                  <button
                    type="button"
                    onClick={() => { onSelect(search.trim()); setOpen(false); setSearch(""); }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-t mt-1 pt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="italic">Usar "{search.trim()}"</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Small inline Plus for the "custom" hint
function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function getModelsForMake(make: string): string[] {
  return VEHICLE_DATA[make]?.models || [];
}

export default function VehicleMakeModelSelector({ make, model, variant, onMakeChange, onModelChange, onVariantChange }: Props) {
  const { t } = useLanguage();

  const models = useMemo(() => VEHICLE_DATA[make]?.models || [], [make]);
  const submodels = useMemo(() => {
    if (!make || !model) return [];
    return SUBMODELS[`${make}|${model}`] || [];
  }, [make, model]);

  const handleMakeChange = (newMake: string) => {
    onMakeChange(newMake);
    if (make !== newMake) {
      onModelChange("");
      onVariantChange?.("");
    }
  };

  const handleModelChange = (newModel: string) => {
    onModelChange(newModel);
    if (model !== newModel) onVariantChange?.("");
  };

  return (
    <>
      <DropdownField
        label={`${t('vehicles.make')} *`}
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
        label={`${t('vehicles.model')} *`}
        value={model}
        options={models}
        onSelect={handleModelChange}
        placeholder={models.length > 0 ? (t('vehicles.searchModel') || "Pesquisar modelo...") : (t('vehicles.selectMakeFirst') || "Selecione a marca primeiro")}
        disabled={models.length === 0 && !make}
        renderOption={(opt) => <span>{opt}</span>}
      />
      {onVariantChange && (
        <div className="col-span-2">
          <DropdownField
            label="Versão / Submodelo"
            value={variant || ""}
            options={submodels}
            onSelect={(v) => onVariantChange(v)}
            placeholder={
              !model
                ? "Selecione o modelo primeiro"
                : submodels.length > 0
                ? "Escolha a versão (motor, acabamento…)"
                : "Sem versões predefinidas — escreva para adicionar"
            }
            disabled={!model}
            allowCustom
            renderOption={(opt) => <span>{opt}</span>}
          />
          {variant && (
            <button
              type="button"
              onClick={() => onVariantChange("")}
              className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Limpar versão
            </button>
          )}
        </div>
      )}
    </>
  );
}
