-- Migration: Consolidated chemical library
-- All vineyard, arable, and orchard chemicals in a single table
-- Pre-merged duplicates with correct applicable_to arrays
-- Standalone — no dependency on old per-module tables

-- ---------------------------------------------------------------------------
-- 1. Create unified chemical_library table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chemical_library (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_name      TEXT NOT NULL,
  name_variants      TEXT[] NOT NULL DEFAULT '{}',
  chemical_type      TEXT NOT NULL DEFAULT 'other'
    CHECK (chemical_type IN ('fertiliser','fungicide','herbicide','insecticide','growth_regulator','seed_treatment','other')),
  n_content_percent  NUMERIC NOT NULL DEFAULT 0,
  fertiliser_subtype TEXT CHECK (fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed') OR fertiliser_subtype IS NULL),
  active_ingredient  TEXT,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  applicable_to      TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chemical_library_name ON public.chemical_library USING btree (LOWER(chemical_name));
CREATE INDEX IF NOT EXISTS idx_chemical_library_variants ON public.chemical_library USING gin (name_variants);
CREATE INDEX IF NOT EXISTS idx_chemical_library_applicable ON public.chemical_library USING gin (applicable_to);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_chemical_library ON public.chemical_library;
CREATE TRIGGER set_updated_at_chemical_library
  BEFORE UPDATE ON public.chemical_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: public read
ALTER TABLE public.chemical_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read chemical library" ON public.chemical_library;
CREATE POLICY "Anyone can read chemical library"
  ON public.chemical_library FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. Shared vineyard + arable + orchard fertilisers (merged duplicates)
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Urea',
 ARRAY['46N','carbamide','CO(NH2)2','granular urea','prilled urea'],
 'fertiliser', 46.0, 'synthetic_n', 'urea', true, ARRAY['vineyard','arable','orchard']),
('Ammonium Nitrate',
 ARRAY['AN','34.5N','ammonium nitrate 34.5','nitram','AN 34.5','Nitram','prilled AN'],
 'fertiliser', 34.5, 'synthetic_n', 'ammonium nitrate', true, ARRAY['vineyard','arable','orchard']),
('Ammonium Sulphate',
 ARRAY['ammonium sulfate','(NH4)2SO4','sulphate of ammonia','AS 21'],
 'fertiliser', 21.0, 'synthetic_n', 'ammonium sulphate', true, ARRAY['vineyard','arable','orchard']);

-- ---------------------------------------------------------------------------
-- 3. Vineyard + orchard fertilisers (not in arable)
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Calcium Ammonium Nitrate',
 ARRAY['CAN','CAN 27','CAN27','calcium ammonium nitrate 27','nitram plus','Extran'],
 'fertiliser', 27.0, 'synthetic_n', 'calcium ammonium nitrate', true, ARRAY['vineyard','orchard']),
('Calcium Nitrate',
 ARRAY['Ca(NO3)2','calcium nitrate 15.5','Tropicote','Calcinit','YaraLiva Tropicote'],
 'fertiliser', 15.5, 'synthetic_n', 'calcium nitrate', true, ARRAY['vineyard','orchard']),
('Calcium Chloride',
 ARRAY['CaCl2','Stopit','stop it','Calmax','calcium chloride foliar'],
 'fertiliser', 0.0, NULL, 'calcium chloride', true, ARRAY['vineyard','orchard']),
('Bittersalz',
 ARRAY['bitter salz','bitters alz','Epsom salts','epsom salt','magnesium sulphate','MgSO4','kieserite','Magflo','magflo','Magnesia'],
 'fertiliser', 0.0, NULL, 'magnesium sulphate', true, ARRAY['vineyard','orchard']),
('Sulphate of Potash',
 ARRAY['SOP','potassium sulphate','K2SO4','Krista SOP','Lono K','lono-k','lonoK'],
 'fertiliser', 0.0, NULL, 'potassium sulphate', true, ARRAY['vineyard','orchard']),
('Biochel Fe',
 ARRAY['biochel iron','Fe chelate','iron chelate','Sequestrene','sequestrene iron','Librel Fe','librel iron','Hortaferro','ferric chelate'],
 'fertiliser', 0.0, NULL, 'iron chelate EDTA', true, ARRAY['vineyard','orchard']),
('Brexil Ca',
 ARRAY['brexil calcium','calcium chelate','Calcinit chelate'],
 'fertiliser', 0.0, NULL, 'calcium chelate EDTA', true, ARRAY['vineyard','orchard']),
('Brexil Zn',
 ARRAY['zinc chelate','Zn chelate','Librel Zn','librel zinc','biochel zinc','biochel Zn'],
 'fertiliser', 0.0, NULL, 'zinc chelate', true, ARRAY['vineyard','orchard']),
('Brexil Mn',
 ARRAY['manganese chelate','Mn chelate','Librel Mn','librel manganese','biochel manganese','biochel Mn'],
 'fertiliser', 0.0, NULL, 'manganese chelate', true, ARRAY['vineyard','orchard']),
('Bortrac',
 ARRAY['bortrac boron','Solubor','solubor boron','Borax','borax','boron foliar'],
 'fertiliser', 0.0, NULL, 'boron', true, ARRAY['vineyard','orchard']);

-- ---------------------------------------------------------------------------
-- 4. Vineyard-only fertilisers
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Potassium Nitrate',
 ARRAY['KNO3','potassium nitrate 13','Krista K','YaraVera Krista K'],
 'fertiliser', 13.0, 'synthetic_n', 'potassium nitrate', true, ARRAY['vineyard']),
('Diammonium Phosphate',
 ARRAY['DAP','18:46','di-ammonium phosphate'],
 'fertiliser', 18.0, 'synthetic_n', 'diammonium phosphate', true, ARRAY['vineyard']),
('Monoammonium Phosphate',
 ARRAY['MAP','12:61','mono-ammonium phosphate'],
 'fertiliser', 12.0, 'synthetic_n', 'monoammonium phosphate', true, ARRAY['vineyard']),
('Liquid Nitrogen UAN',
 ARRAY['UAN','urea ammonium nitrate','liquid N','28N','32N','liquid urea'],
 'fertiliser', 28.0, 'synthetic_n', 'urea ammonium nitrate solution', true, ARRAY['vineyard']),
('Companion Gold',
 ARRAY['companion gold bio','Companion Gold biostimulant'],
 'fertiliser', 11.0, 'organic_compost', 'amino acids', true, ARRAY['vineyard']),
('CropLift',
 ARRAY['crop lift','croplift','croplift biostimulant'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids', true, ARRAY['vineyard']),
('PhysioCrop',
 ARRAY['physio crop','physiocrop','physio-crop'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids', true, ARRAY['vineyard']),
('Polyverdol',
 ARRAY['poly verdol','polyverdol foliar'],
 'fertiliser', 5.0, 'organic_compost', 'amino acids + micronutrients', true, ARRAY['vineyard']),
('Lono Plus',
 ARRAY['lono+','lonoplus','lono plus foliar'],
 'fertiliser', 3.0, 'organic_compost', 'potassium + amino acids', true, ARRAY['vineyard']),
('Kelpak',
 ARRAY['kelp-ak','kelpak seaweed'],
 'fertiliser', 1.0, 'organic_compost', 'seaweed extract', true, ARRAY['vineyard']),
('Maxicrop',
 ARRAY['maxi crop','maxicrop seaweed','maxicrop triple','maxicrop plus'],
 'fertiliser', 1.0, 'organic_compost', 'seaweed extract', true, ARRAY['vineyard']),
('Seamac',
 ARRAY['sea mac','seamac PL','seamac seaweed'],
 'fertiliser', 2.0, 'organic_compost', 'seaweed extract', true, ARRAY['vineyard']),
('Iodus',
 ARRAY['iodus 40','iodus seaweed','iodus biostimulant'],
 'fertiliser', 0.0, 'organic_compost', 'seaweed + iodine', true, ARRAY['vineyard']),
('Aminosol',
 ARRAY['amino sol','aminosol foliar'],
 'fertiliser', 8.0, 'organic_compost', 'hydrolysed amino acids', true, ARRAY['vineyard']),
('Calfite Extra',
 ARRAY['calfite','calfite calcium','calfite extra foliar'],
 'fertiliser', 0.0, NULL, 'calcium', true, ARRAY['vineyard']),
('Magnesium Thiosulphate',
 ARRAY['Mg thiosulphate','MgTS','magnesium thiosulfate'],
 'fertiliser', 0.0, NULL, 'magnesium thiosulphate', true, ARRAY['vineyard']),
('Polysulphate',
 ARRAY['poly sulphate','polysulphate fertiliser'],
 'fertiliser', 0.0, NULL, 'potassium, magnesium, sulphur, calcium', true, ARRAY['vineyard']),
('PHruit',
 ARRAY['phruit','phruit phosphorus','phosphorus foliar','Phostrogen'],
 'fertiliser', 0.0, NULL, 'phosphorus', true, ARRAY['vineyard']),
('Cropaid',
 ARRAY['crop aid','cropaid foliar','crop-aid'],
 'fertiliser', 0.0, NULL, 'micronutrient blend', true, ARRAY['vineyard']),
('Magflo',
 ARRAY['mag flo','magflo foliar'],
 'fertiliser', 0.0, NULL, 'magnesium', true, ARRAY['vineyard']),
('Biochel FE',
 ARRAY['biochel-fe','biochel fe iron'],
 'fertiliser', 0.0, NULL, 'iron chelate', true, ARRAY['vineyard']),
('Lono K',
 ARRAY['lono-k','lonok','lono potassium'],
 'fertiliser', 0.0, NULL, 'potassium sulphate', true, ARRAY['vineyard']);

-- ---------------------------------------------------------------------------
-- 5. Vineyard + orchard fungicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Copper Hydroxide',
 ARRAY['Headland Copper','headland fmc copper','headland/fmc copper','Kocide','kocide','Cuprocaffaro','cuprocaffaro','Funguran','funguran','Copper WDG'],
 'fungicide', 0.0, NULL, 'copper hydroxide', true, ARRAY['vineyard','orchard']),
('Copper Oxychloride',
 ARRAY['Cuprokylt','Coprantol','copper oxychloride'],
 'fungicide', 0.0, NULL, 'copper oxychloride', true, ARRAY['vineyard','orchard']),
('Sulphur',
 ARRAY['sulfur','Thiopron','thiopron','Microthiol','microthiol','Kumulus','kumulus','WG Sulphur','sulphur 80','Sulgran','Sporan','Thiovit','Headland Sulphur'],
 'fungicide', 0.0, NULL, 'sulphur', true, ARRAY['vineyard','orchard']),
('Mancozeb',
 ARRAY['Dithane','dithane','Penncozeb','penncozeb','Vimancoz','Electis mancozeb'],
 'fungicide', 0.0, NULL, 'mancozeb', true, ARRAY['vineyard','orchard']),
('Bacillus subtilis',
 ARRAY['Serenade','serenade aso','Serenade MAX'],
 'fungicide', 0.0, NULL, 'bacillus subtilis QST 713', true, ARRAY['vineyard','orchard']);

-- ---------------------------------------------------------------------------
-- 6. Vineyard-only fungicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Folpet',
 ARRAY['Folpan','folpan','Folpet 80','Captan','captan'],
 'fungicide', 0.0, NULL, 'folpet', true, ARRAY['vineyard']),
('Metalaxyl-M + Mancozeb',
 ARRAY['Ridomil Gold','ridomil gold','Ridomil MZ'],
 'fungicide', 0.0, NULL, 'metalaxyl-m + mancozeb', true, ARRAY['vineyard']),
('Mandipropamid',
 ARRAY['Revus','revus'],
 'fungicide', 0.0, NULL, 'mandipropamid', true, ARRAY['vineyard']),
('Cyflufenamid',
 ARRAY['Talius','talius'],
 'fungicide', 0.0, NULL, 'cyflufenamid', true, ARRAY['vineyard']),
('Quinoxyfen',
 ARRAY['Vayo','vayo'],
 'fungicide', 0.0, NULL, 'quinoxyfen', true, ARRAY['vineyard']),
('Boscalid + Metiram',
 ARRAY['Cabrio Top','cabriotop','cabrio top'],
 'fungicide', 0.0, NULL, 'boscalid + metiram', true, ARRAY['vineyard']),
('Valifenalate + Mancozeb',
 ARRAY['Xerxes','xerxes','Valis M'],
 'fungicide', 0.0, NULL, 'valifenalate + mancozeb', true, ARRAY['vineyard']),
('Benalaxyl-M + Mancozeb',
 ARRAY['Kantor','kantor'],
 'fungicide', 0.0, NULL, 'benalaxyl-m + mancozeb', true, ARRAY['vineyard']),
('Ametoctradin + Dimethomorph',
 ARRAY['Zampro','zampro'],
 'fungicide', 0.0, NULL, 'ametoctradin + dimethomorph', true, ARRAY['vineyard']),
('Cyprodinil + Fludioxonil',
 ARRAY['Switch','switch fungicide'],
 'fungicide', 0.0, NULL, 'cyprodinil + fludioxonil', true, ARRAY['vineyard']),
('Dimethomorph',
 ARRAY['Forum','forum star','Acrobat','acrobat mz'],
 'fungicide', 0.0, NULL, 'dimethomorph', true, ARRAY['vineyard']),
('Trifloxystrobin + Tebuconazole',
 ARRAY['Nativo','nativo'],
 'fungicide', 0.0, NULL, 'trifloxystrobin + tebuconazole', true, ARRAY['vineyard']);

-- ---------------------------------------------------------------------------
-- 7. Vineyard + orchard herbicide
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Glyphosate',
 ARRAY['Roundup','roundup','Powermax','powermax','Touchdown','touchdown','Gallup','gallup','Glyphogan','glyphogan'],
 'herbicide', 0.0, NULL, 'glyphosate', true, ARRAY['vineyard','orchard']);

-- ---------------------------------------------------------------------------
-- 8. Vineyard-only herbicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Flazasulfuron',
 ARRAY['Chikara','chikara'],
 'herbicide', 0.0, NULL, 'flazasulfuron', true, ARRAY['vineyard']),
('Pelargonic Acid',
 ARRAY['Beloukha','beloukha'],
 'herbicide', 0.0, NULL, 'pelargonic acid', true, ARRAY['vineyard']);

-- ---------------------------------------------------------------------------
-- 9. Vineyard-only other
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('BlackJAK',
 ARRAY['black jak','blackjak','Black Jak adjuvant'],
 'other', 0.0, NULL, 'spreader-sticker / adjuvant', true, ARRAY['vineyard']),
('Agral',
 ARRAY['agral wetter','agral 90','agral spreader'],
 'other', 0.0, NULL, 'non-ionic surfactant', true, ARRAY['vineyard']),
('Silwet',
 ARRAY['Silwet L-77','silwet organosilicone'],
 'other', 0.0, NULL, 'organosilicone surfactant', true, ARRAY['vineyard']);

-- ---------------------------------------------------------------------------
-- 10. Arable-only growth regulators
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Chlormequat 720',     ARRAY['CCC 720','Adjust','Manipulator','chlormequat chloride'], 'growth_regulator', 0.0, NULL, 'chlormequat chloride', true, ARRAY['arable']),
('Moddus',              ARRAY['trinexapac-ethyl','Moddus Evo'], 'growth_regulator', 0.0, NULL, 'trinexapac-ethyl', true, ARRAY['arable']),
('Canopy',              ARRAY['mepiquat chloride + prohexadione'], 'growth_regulator', 0.0, NULL, 'mepiquat chloride + prohexadione-calcium', true, ARRAY['arable']),
('Medax Max',           ARRAY['mepiquat chloride + prohexadione-calcium'], 'growth_regulator', 0.0, NULL, 'mepiquat chloride + prohexadione-calcium', true, ARRAY['arable']),
('Terpal',              ARRAY['ethephon + mepiquat chloride'], 'growth_regulator', 0.0, NULL, 'ethephon + mepiquat chloride', true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 11. Arable-only fungicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Proline',             ARRAY['prothioconazole','Proline 275'], 'fungicide', 0.0, NULL, 'prothioconazole', true, ARRAY['arable']),
('Aviator Xpro',       ARRAY['bixafen + prothioconazole'], 'fungicide', 0.0, NULL, 'bixafen + prothioconazole', true, ARRAY['arable']),
('Adexar',              ARRAY['epoxiconazole + fluxapyroxad'], 'fungicide', 0.0, NULL, 'epoxiconazole + fluxapyroxad', true, ARRAY['arable']),
('Ascra Xpro',         ARRAY['bixafen + fluopyram + prothioconazole'], 'fungicide', 0.0, NULL, 'bixafen + fluopyram + prothioconazole', true, ARRAY['arable']),
('Revystar XE',        ARRAY['mefentrifluconazole + fluxapyroxad'], 'fungicide', 0.0, NULL, 'mefentrifluconazole + fluxapyroxad', true, ARRAY['arable']),
('Elatus Era',          ARRAY['benzovindiflupyr + prothioconazole'], 'fungicide', 0.0, NULL, 'benzovindiflupyr + prothioconazole', true, ARRAY['arable']),
('Imtrex',              ARRAY['fluxapyroxad'], 'fungicide', 0.0, NULL, 'fluxapyroxad', true, ARRAY['arable']),
('Siltra Xpro',        ARRAY['bixafen + prothioconazole'], 'fungicide', 0.0, NULL, 'bixafen + prothioconazole', true, ARRAY['arable']),
('Amistar',             ARRAY['azoxystrobin','Amistar Opti'], 'fungicide', 0.0, NULL, 'azoxystrobin', true, ARRAY['arable']),
('Bravo',               ARRAY['chlorothalonil','Bravo 500'], 'fungicide', 0.0, NULL, 'chlorothalonil', true, ARRAY['arable']),
('Fandango',            ARRAY['prothioconazole + fluoxastrobin'], 'fungicide', 0.0, NULL, 'prothioconazole + fluoxastrobin', true, ARRAY['arable']),
('Firefly',             ARRAY['difenoconazole + fluxapyroxad'], 'fungicide', 0.0, NULL, 'difenoconazole + fluxapyroxad', true, ARRAY['arable']),
('Librax',              ARRAY['fluxapyroxad + metconazole'], 'fungicide', 0.0, NULL, 'fluxapyroxad + metconazole', true, ARRAY['arable']),
('Prosaro',             ARRAY['prothioconazole + tebuconazole'], 'fungicide', 0.0, NULL, 'prothioconazole + tebuconazole', true, ARRAY['arable']),
('Gleam',               ARRAY['pyraclostrobin + epoxiconazole'], 'fungicide', 0.0, NULL, 'pyraclostrobin + epoxiconazole', true, ARRAY['arable']),
('Ceriax',              ARRAY['epoxiconazole + fluxapyroxad + pyraclostrobin'], 'fungicide', 0.0, NULL, 'epoxiconazole + fluxapyroxad + pyraclostrobin', true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 12. Arable-only herbicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Roundup',             ARRAY['glyphosate','Roundup PowerMax','Roundup ProActive'], 'herbicide', 0.0, NULL, 'glyphosate', true, ARRAY['arable']),
('Stomp Aqua',          ARRAY['pendimethalin','Stomp'], 'herbicide', 0.0, NULL, 'pendimethalin', true, ARRAY['arable']),
('Crystal',             ARRAY['flufenacet + pendimethalin'], 'herbicide', 0.0, NULL, 'flufenacet + pendimethalin', true, ARRAY['arable']),
('Liberator',           ARRAY['flufenacet + diflufenican'], 'herbicide', 0.0, NULL, 'flufenacet + diflufenican', true, ARRAY['arable']),
('Atlantis',            ARRAY['mesosulfuron + iodosulfuron','Atlantis Star'], 'herbicide', 0.0, NULL, 'mesosulfuron-methyl + iodosulfuron-methyl', true, ARRAY['arable']),
('Pacifica Plus',       ARRAY['mesosulfuron + iodosulfuron + amidosulfuron'], 'herbicide', 0.0, NULL, 'mesosulfuron + iodosulfuron + amidosulfuron', true, ARRAY['arable']),
('Axial',               ARRAY['pinoxaden','Axial Pro'], 'herbicide', 0.0, NULL, 'pinoxaden', true, ARRAY['arable']),
('Broadway Star',       ARRAY['florasulam + pyroxsulam'], 'herbicide', 0.0, NULL, 'florasulam + pyroxsulam', true, ARRAY['arable']),
('Pixxaro',             ARRAY['halauxifen-methyl + fluroxypyr'], 'herbicide', 0.0, NULL, 'halauxifen-methyl + fluroxypyr', true, ARRAY['arable']),
('Ally Max SX',        ARRAY['metsulfuron + tribenuron','Ally Max'], 'herbicide', 0.0, NULL, 'metsulfuron-methyl + tribenuron-methyl', true, ARRAY['arable']),
('MCPA 750',            ARRAY['MCPA'], 'herbicide', 0.0, NULL, 'MCPA', true, ARRAY['arable']),
('Starane XL',         ARRAY['fluroxypyr + florasulam'], 'herbicide', 0.0, NULL, 'fluroxypyr + florasulam', true, ARRAY['arable']),
('Hawk',                ARRAY['clodinafop + prosulfocarb'], 'herbicide', 0.0, NULL, 'clodinafop-propargyl + prosulfocarb', true, ARRAY['arable']),
('Defy',                ARRAY['prosulfocarb'], 'herbicide', 0.0, NULL, 'prosulfocarb', true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 13. Arable + orchard insecticides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Decis Forte',         ARRAY['deltamethrin','Decis'], 'insecticide', 0.0, NULL, 'deltamethrin', true, ARRAY['arable','orchard']),
('Mavrik',              ARRAY['tau-fluvalinate'], 'insecticide', 0.0, NULL, 'tau-fluvalinate', true, ARRAY['arable','orchard']);

-- ---------------------------------------------------------------------------
-- 14. Arable-only insecticides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Hallmark Zeon',       ARRAY['lambda-cyhalothrin','Hallmark'], 'insecticide', 0.0, NULL, 'lambda-cyhalothrin', true, ARRAY['arable']),
('Biscaya',             ARRAY['thiacloprid'], 'insecticide', 0.0, NULL, 'thiacloprid', true, ARRAY['arable']),
('Aphox',               ARRAY['pirimicarb'], 'insecticide', 0.0, NULL, 'pirimicarb', true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 15. Arable-only seed treatments
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Redigo Pro',          ARRAY['prothioconazole + tebuconazole'], 'seed_treatment', 0.0, NULL, 'prothioconazole + tebuconazole', true, ARRAY['arable']),
('Raxil Star',          ARRAY['tebuconazole + prothioconazole + fluopyram'], 'seed_treatment', 0.0, NULL, 'tebuconazole + prothioconazole + fluopyram', true, ARRAY['arable']),
('Vibrance Duo',        ARRAY['sedaxane + fludioxonil'], 'seed_treatment', 0.0, NULL, 'sedaxane + fludioxonil', true, ARRAY['arable']),
('Celest Extra',        ARRAY['fludioxonil + cyprodinil'], 'seed_treatment', 0.0, NULL, 'fludioxonil + cyprodinil', true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 16. Arable-only fertilisers (not duplicated with vineyard)
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('UAN 28',              ARRAY['UAN','liquid nitrogen 28','N28'], 'fertiliser', 28, 'synthetic_n', 'urea-ammonium nitrate', true, ARRAY['arable']),
('UAN 32',              ARRAY['liquid nitrogen 32','N32'], 'fertiliser', 32, 'synthetic_n', 'urea-ammonium nitrate', true, ARRAY['arable']),
('CAN',                 ARRAY['calcium ammonium nitrate','CAN 27'], 'fertiliser', 27, 'synthetic_n', 'calcium ammonium nitrate', true, ARRAY['arable']),
('Manganese Sulphate',  ARRAY['MnSO4','ManganMax'], 'fertiliser', 0, NULL, 'manganese sulphate', true, ARRAY['arable']),
('Epsom Salts',         ARRAY['Bittersalz','MgSO4','magnesium sulphate'], 'fertiliser', 0, NULL, 'magnesium sulphate', true, ARRAY['arable']),
('Compost',             ARRAY['green waste compost','mushroom compost'], 'fertiliser', 1, 'organic_compost', NULL, true, ARRAY['arable']),
('FYM',                 ARRAY['farmyard manure','muck'], 'fertiliser', 0.6, 'organic_manure', NULL, true, ARRAY['arable']),
('Digestate',           ARRAY['AD digestate','anaerobic digestate'], 'fertiliser', 0.5, 'organic_manure', NULL, true, ARRAY['arable']);

-- ---------------------------------------------------------------------------
-- 17. Orchard-only fungicides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Captan',
 ARRAY['captan 80','Merpan','merpan','captan WG'],
 'fungicide', 0.0, NULL, 'captan', true, ARRAY['orchard']),
('Myclobutanil',
 ARRAY['Systhane','systhane','Systhane 20EW'],
 'fungicide', 0.0, NULL, 'myclobutanil', true, ARRAY['orchard']),
('Penconazole',
 ARRAY['Topas','topas'],
 'fungicide', 0.0, NULL, 'penconazole', true, ARRAY['orchard']),
('Difenoconazole',
 ARRAY['Score','score','Difcor'],
 'fungicide', 0.0, NULL, 'difenoconazole', true, ARRAY['orchard']),
('Dithianon',
 ARRAY['Delan','delan','Delan Pro'],
 'fungicide', 0.0, NULL, 'dithianon', true, ARRAY['orchard']),
('Dodine',
 ARRAY['Syllit','syllit'],
 'fungicide', 0.0, NULL, 'dodine', true, ARRAY['orchard']),
('Boscalid + Pyraclostrobin',
 ARRAY['Bellis','bellis'],
 'fungicide', 0.0, NULL, 'boscalid + pyraclostrobin', true, ARRAY['orchard']),
('Trifloxystrobin',
 ARRAY['Flint','flint'],
 'fungicide', 0.0, NULL, 'trifloxystrobin', true, ARRAY['orchard']);

-- ---------------------------------------------------------------------------
-- 18. Orchard-only insecticides
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Codling Moth Granulovirus',
 ARRAY['Madex','madex','CpGV','Carpovirusine','Granupom'],
 'insecticide', 0.0, NULL, 'cydia pomonella granulovirus', true, ARRAY['orchard']),
('Spinosad',
 ARRAY['SpinTor','spintor','Tracer','tracer'],
 'insecticide', 0.0, NULL, 'spinosad', true, ARRAY['orchard']),
('Chlorantraniliprole',
 ARRAY['Coragen','coragen'],
 'insecticide', 0.0, NULL, 'chlorantraniliprole', true, ARRAY['orchard']),
('Acetamiprid',
 ARRAY['Gazelle','gazelle'],
 'insecticide', 0.0, NULL, 'acetamiprid', true, ARRAY['orchard']),
('Spirotetramat',
 ARRAY['Movento','movento'],
 'insecticide', 0.0, NULL, 'spirotetramat', true, ARRAY['orchard']);

-- ---------------------------------------------------------------------------
-- 19. Orchard-only other
-- ---------------------------------------------------------------------------
INSERT INTO public.chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified, applicable_to) VALUES
('Kaolin Clay',
 ARRAY['Surround','surround','Surround WP','kaolin'],
 'other', 0.0, NULL, 'kaolin clay', true, ARRAY['orchard']),
('Neem Oil',
 ARRAY['azadirachtin','NeemAzal','neemazal','neem extract'],
 'insecticide', 0.0, NULL, 'azadirachtin', true, ARRAY['orchard']),
('Ethephon (thinning)',
 ARRAY['Ethrel','ethrel','MaxCel','Flordimex'],
 'other', 0.0, NULL, 'ethephon', true, ARRAY['orchard']);

-- ---------------------------------------------------------------------------
-- 20. Drop old tables (IF EXISTS — safe if already dropped)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.vineyard_chemical_library CASCADE;
DROP TABLE IF EXISTS public.arable_chemical_library CASCADE;
