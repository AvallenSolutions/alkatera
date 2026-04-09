-- vineyard_chemical_library
-- Global (non-org) reference table of common vineyard chemicals with N-content data.
-- Used to automatically enrich spray diary imports — no manual entry needed for N2O calculations.

CREATE TABLE public.vineyard_chemical_library (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chemical_name       TEXT        NOT NULL,
  name_variants       TEXT[]      NOT NULL DEFAULT '{}',
  chemical_type       TEXT        NOT NULL
                        CHECK (chemical_type IN ('fertiliser','fungicide','herbicide','insecticide','other')),
  n_content_percent   NUMERIC     NOT NULL DEFAULT 0
                        CHECK (n_content_percent >= 0 AND n_content_percent <= 100),
  fertiliser_subtype  TEXT        CHECK (
                        fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed')
                        OR fertiliser_subtype IS NULL
                      ),
  active_ingredient   TEXT,
  is_verified         BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Global read-only for authenticated users; writes via service role only
ALTER TABLE public.vineyard_chemical_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chemical library"
  ON public.vineyard_chemical_library
  FOR SELECT USING (true);

-- GIN index for fast array queries on name_variants
CREATE INDEX idx_chem_lib_variants ON public.vineyard_chemical_library USING GIN (name_variants);
-- B-tree for case-insensitive canonical name lookups
CREATE INDEX idx_chem_lib_name ON public.vineyard_chemical_library (LOWER(chemical_name));

-- ============================================================
-- SEED DATA — common UK/EU vineyard chemicals
-- ============================================================

INSERT INTO public.vineyard_chemical_library
  (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient)
VALUES

-- === SYNTHETIC NITROGEN FERTILISERS ===
('Urea',
 ARRAY['46N','carbamide','CO(NH2)2'],
 'fertiliser', 46.0, 'synthetic_n', 'urea'),

('Ammonium Nitrate',
 ARRAY['AN','34.5N','ammonium nitrate 34.5','nitram'],
 'fertiliser', 34.5, 'synthetic_n', 'ammonium nitrate'),

('Calcium Ammonium Nitrate',
 ARRAY['CAN','CAN 27','CAN27','calcium ammonium nitrate 27','nitram plus','Extran'],
 'fertiliser', 27.0, 'synthetic_n', 'calcium ammonium nitrate'),

('Calcium Nitrate',
 ARRAY['Ca(NO3)2','calcium nitrate 15.5','Tropicote','Calcinit','YaraLiva Tropicote'],
 'fertiliser', 15.5, 'synthetic_n', 'calcium nitrate'),

('Potassium Nitrate',
 ARRAY['KNO3','potassium nitrate 13','Krista K','YaraVera Krista K'],
 'fertiliser', 13.0, 'synthetic_n', 'potassium nitrate'),

('Ammonium Sulphate',
 ARRAY['ammonium sulfate','(NH4)2SO4','sulphate of ammonia'],
 'fertiliser', 21.0, 'synthetic_n', 'ammonium sulphate'),

('Diammonium Phosphate',
 ARRAY['DAP','18:46','di-ammonium phosphate'],
 'fertiliser', 18.0, 'synthetic_n', 'diammonium phosphate'),

('Monoammonium Phosphate',
 ARRAY['MAP','12:61','mono-ammonium phosphate'],
 'fertiliser', 12.0, 'synthetic_n', 'monoammonium phosphate'),

('Liquid Nitrogen UAN',
 ARRAY['UAN','urea ammonium nitrate','liquid N','28N','32N','liquid urea'],
 'fertiliser', 28.0, 'synthetic_n', 'urea ammonium nitrate solution'),

-- === ORGANIC / BIOSTIMULANT FERTILISERS ===
('Companion Gold',
 ARRAY['companion gold bio','Companion Gold biostimulant'],
 'fertiliser', 11.0, 'organic_compost', 'amino acids'),

('CropLift',
 ARRAY['crop lift','croplift','croplift biostimulant'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids'),

('PhysioCrop',
 ARRAY['physio crop','physiocrop','physio-crop'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids'),

('Polyverdol',
 ARRAY['poly verdol','polyverdol foliar'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids + micronutrients'),

('Lono Plus',
 ARRAY['lono+','lonoplus','lono plus foliar'],
 'fertiliser', 3.0, 'organic_compost', 'potassium + amino acids'),

('Kelpak',
 ARRAY['kelp-ak','kelpak seaweed'],
 'fertiliser', 1.0, 'organic_compost', 'seaweed extract'),

('Maxicrop',
 ARRAY['maxi crop','maxicrop seaweed','maxicrop triple','maxicrop plus'],
 'fertiliser', 1.0, 'organic_compost', 'seaweed extract'),

('Seamac',
 ARRAY['sea mac','seamac PL','seamac seaweed'],
 'fertiliser', 2.0, 'organic_compost', 'seaweed extract'),

('Iodus',
 ARRAY['iodus 40','iodus seaweed','iodus biostimulant'],
 'fertiliser', 0.0, 'organic_compost', 'seaweed + iodine'),

('Aminosol',
 ARRAY['amino sol','aminosol foliar'],
 'fertiliser', 8.0, 'organic_compost', 'hydrolysed amino acids'),

-- === ZERO-N FERTILISERS — Calcium ===
('Calcium Chloride',
 ARRAY['CaCl2','Stopit','stop it','Calmax','calcium chloride foliar'],
 'fertiliser', 0.0, NULL, 'calcium chloride'),

('Calfite Extra',
 ARRAY['calfite','calfite calcium','calfite extra foliar'],
 'fertiliser', 0.0, NULL, 'calcium'),

('Brexil Ca',
 ARRAY['brexil calcium','calcium chelate','Calcinit chelate'],
 'fertiliser', 0.0, NULL, 'calcium chelate EDTA'),

-- === ZERO-N FERTILISERS — Magnesium ===
('Bittersalz',
 ARRAY['bitter salz','bitters alz','Epsom salts','epsom salt','magnesium sulphate',
       'MgSO4','kieserite','Magflo','magflo','Magnesia'],
 'fertiliser', 0.0, NULL, 'magnesium sulphate'),

('Magnesium Thiosulphate',
 ARRAY['Mg thiosulphate','MgTS','magnesium thiosulfate'],
 'fertiliser', 0.0, NULL, 'magnesium thiosulphate'),

-- === ZERO-N FERTILISERS — Potassium ===
('Sulphate of Potash',
 ARRAY['SOP','potassium sulphate','K2SO4','Krista SOP','Lono K','lono-k','lonoK'],
 'fertiliser', 0.0, NULL, 'potassium sulphate'),

('Polysulphate',
 ARRAY['poly sulphate','polysulphate fertiliser'],
 'fertiliser', 0.0, NULL, 'potassium, magnesium, sulphur, calcium'),

-- === ZERO-N FERTILISERS — Iron ===
('Biochel Fe',
 ARRAY['biochel iron','Fe chelate','iron chelate','Sequestrene','sequestrene iron',
       'Librel Fe','librel iron','Hortaferro','ferric chelate'],
 'fertiliser', 0.0, NULL, 'iron chelate EDTA'),

-- === ZERO-N FERTILISERS — Zinc ===
('Brexil Zn',
 ARRAY['zinc chelate','Zn chelate','Librel Zn','librel zinc','biochel zinc','biochel Zn'],
 'fertiliser', 0.0, NULL, 'zinc chelate'),

-- === ZERO-N FERTILISERS — Manganese ===
('Brexil Mn',
 ARRAY['manganese chelate','Mn chelate','Librel Mn','librel manganese','biochel manganese','biochel Mn'],
 'fertiliser', 0.0, NULL, 'manganese chelate'),

-- === ZERO-N FERTILISERS — Boron ===
('Bortrac',
 ARRAY['bortrac boron','Solubor','solubor boron','Borax','borax','boron foliar'],
 'fertiliser', 0.0, NULL, 'boron'),

-- === ZERO-N FERTILISERS — Phosphorus ===
('PHruit',
 ARRAY['phruit','phruit phosphorus','phosphorus foliar','Phostrogen'],
 'fertiliser', 0.0, NULL, 'phosphorus'),

-- === ZERO-N FERTILISERS — Multi-nutrient ===
('Cropaid',
 ARRAY['crop aid','cropaid foliar','crop-aid'],
 'fertiliser', 0.0, NULL, 'micronutrient blend'),

-- === FUNGICIDES ===
('Copper Hydroxide',
 ARRAY['Headland Copper','headland fmc copper','headland/fmc copper','Kocide','kocide',
       'Cuprocaffaro','cuprocaffaro','Funguran','funguran','Copper WDG'],
 'fungicide', 0.0, NULL, 'copper hydroxide'),

('Copper Oxychloride',
 ARRAY['Cuprokylt','Coprantol','copper oxychloride'],
 'fungicide', 0.0, NULL, 'copper oxychloride'),

('Sulphur',
 ARRAY['sulfur','Thiopron','thiopron','Microthiol','microthiol','Kumulus','kumulus',
       'WG Sulphur','sulphur 80','Sulgran','Sporan','Thiovit','Headland Sulphur'],
 'fungicide', 0.0, NULL, 'sulphur'),

('Mancozeb',
 ARRAY['Dithane','dithane','Penncozeb','penncozeb','Vimancoz','Electis mancozeb'],
 'fungicide', 0.0, NULL, 'mancozeb'),

('Folpet',
 ARRAY['Folpan','folpan','Folpet 80','Captan','captan'],
 'fungicide', 0.0, NULL, 'folpet'),

('Metalaxyl-M + Mancozeb',
 ARRAY['Ridomil Gold','ridomil gold','Ridomil MZ'],
 'fungicide', 0.0, NULL, 'metalaxyl-m + mancozeb'),

('Mandipropamid',
 ARRAY['Revus','revus'],
 'fungicide', 0.0, NULL, 'mandipropamid'),

('Cyflufenamid',
 ARRAY['Talius','talius'],
 'fungicide', 0.0, NULL, 'cyflufenamid'),

('Quinoxyfen',
 ARRAY['Vayo','vayo'],
 'fungicide', 0.0, NULL, 'quinoxyfen'),

('Boscalid + Metiram',
 ARRAY['Cabrio Top','cabriotop','cabrio top'],
 'fungicide', 0.0, NULL, 'boscalid + metiram'),

('Valifenalate + Mancozeb',
 ARRAY['Xerxes','xerxes','Valis M'],
 'fungicide', 0.0, NULL, 'valifenalate + mancozeb'),

('Benalaxyl-M + Mancozeb',
 ARRAY['Kantor','kantor'],
 'fungicide', 0.0, NULL, 'benalaxyl-m + mancozeb'),

('Ametoctradin + Dimethomorph',
 ARRAY['Zampro','zampro'],
 'fungicide', 0.0, NULL, 'ametoctradin + dimethomorph'),

('Cyprodinil + Fludioxonil',
 ARRAY['Switch','switch fungicide'],
 'fungicide', 0.0, NULL, 'cyprodinil + fludioxonil'),

('Bacillus subtilis',
 ARRAY['Serenade','serenade aso','Serenade MAX'],
 'fungicide', 0.0, NULL, 'bacillus subtilis QST 713'),

('Dimethomorph',
 ARRAY['Forum','forum star','Acrobat','acrobat mz'],
 'fungicide', 0.0, NULL, 'dimethomorph'),

('Trifloxystrobin + Tebuconazole',
 ARRAY['Nativo','nativo'],
 'fungicide', 0.0, NULL, 'trifloxystrobin + tebuconazole'),

('BlackJAK',
 ARRAY['black jak','blackjak','Black Jak adjuvant'],
 'other', 0.0, NULL, 'spreader-sticker / adjuvant'),

-- === HERBICIDES ===
('Glyphosate',
 ARRAY['Roundup','roundup','Powermax','powermax','Touchdown','touchdown',
       'Gallup','gallup','Glyphogan','glyphogan'],
 'herbicide', 0.0, NULL, 'glyphosate'),

('Flazasulfuron',
 ARRAY['Chikara','chikara'],
 'herbicide', 0.0, NULL, 'flazasulfuron'),

('Pelargonic Acid',
 ARRAY['Beloukha','beloukha'],
 'herbicide', 0.0, NULL, 'pelargonic acid'),

-- === ADJUVANTS / OTHER ===
('Agral',
 ARRAY['agral wetter','agral 90','agral spreader'],
 'other', 0.0, NULL, 'non-ionic surfactant'),

('Silwet',
 ARRAY['Silwet L-77','silwet organosilicone'],
 'other', 0.0, NULL, 'organosilicone surfactant'),

('Magflo',
 ARRAY['mag flo','magflo foliar'],
 'fertiliser', 0.0, NULL, 'magnesium'),

('Biochel FE',
 ARRAY['biochel-fe','biochel fe iron'],
 'fertiliser', 0.0, NULL, 'iron chelate'),

('Lono K',
 ARRAY['lono-k','lonok','lono potassium'],
 'fertiliser', 0.0, NULL, 'potassium sulphate');


-- ============================================================
-- ALTER vineyard_spray_chemicals — add N-content tracking
-- ============================================================

ALTER TABLE public.vineyard_spray_chemicals
  ADD COLUMN IF NOT EXISTS n_content_percent   NUMERIC  NOT NULL DEFAULT 0
                                                 CHECK (n_content_percent >= 0 AND n_content_percent <= 100),
  ADD COLUMN IF NOT EXISTS fertiliser_subtype   TEXT
                                                 CHECK (
                                                   fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed')
                                                   OR fertiliser_subtype IS NULL
                                                 ),
  ADD COLUMN IF NOT EXISTS library_matched      BOOLEAN  NOT NULL DEFAULT false;
