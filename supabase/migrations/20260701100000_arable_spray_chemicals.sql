-- Migration: Arable spray chemicals + chemical library
-- Pattern mirrors vineyard_spray_chemicals / vineyard_chemical_library

-- ---------------------------------------------------------------------------
-- 1. Spray chemicals per growing profile
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arable_spray_chemicals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  growing_profile_id UUID NOT NULL REFERENCES public.arable_growing_profiles(id) ON DELETE CASCADE,
  arable_field_id    UUID NOT NULL REFERENCES public.arable_fields(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  chemical_name       TEXT NOT NULL,
  chemical_type       TEXT NOT NULL DEFAULT 'other'
    CHECK (chemical_type IN ('fertiliser','fungicide','herbicide','insecticide','growth_regulator','seed_treatment','other')),
  unit                TEXT NOT NULL DEFAULT 'L',
  rate_per_ha         NUMERIC NOT NULL DEFAULT 0,
  water_rate_l_per_ha NUMERIC,
  total_ha_sprayed    NUMERIC NOT NULL DEFAULT 0,
  total_amount_used   NUMERIC NOT NULL DEFAULT 0,
  applications_count  INTEGER NOT NULL DEFAULT 1,

  n_content_percent   NUMERIC NOT NULL DEFAULT 0,
  fertiliser_subtype  TEXT CHECK (fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed') OR fertiliser_subtype IS NULL),
  library_matched     BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_arable_spray_chemicals_profile ON public.arable_spray_chemicals(growing_profile_id);
CREATE INDEX idx_arable_spray_chemicals_field   ON public.arable_spray_chemicals(arable_field_id);
CREATE INDEX idx_arable_spray_chemicals_org     ON public.arable_spray_chemicals(organization_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_arable_spray_chemicals
  BEFORE UPDATE ON public.arable_spray_chemicals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.arable_spray_chemicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org spray chemicals"
  ON public.arable_spray_chemicals FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert spray chemicals for their org"
  ON public.arable_spray_chemicals FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their org spray chemicals"
  ON public.arable_spray_chemicals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org spray chemicals"
  ON public.arable_spray_chemicals FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Chemical library (lookup table for enrichment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arable_chemical_library (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_name      TEXT NOT NULL,
  name_variants      TEXT[] NOT NULL DEFAULT '{}',
  chemical_type      TEXT NOT NULL DEFAULT 'other'
    CHECK (chemical_type IN ('fertiliser','fungicide','herbicide','insecticide','growth_regulator','seed_treatment','other')),
  n_content_percent  NUMERIC NOT NULL DEFAULT 0,
  fertiliser_subtype TEXT CHECK (fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed') OR fertiliser_subtype IS NULL),
  active_ingredient  TEXT,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_arable_chemical_library_name ON public.arable_chemical_library(chemical_name);
CREATE INDEX idx_arable_chemical_library_type ON public.arable_chemical_library(chemical_type);

CREATE TRIGGER set_updated_at_arable_chemical_library
  BEFORE UPDATE ON public.arable_chemical_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Library is read-only for all authenticated users (no org isolation needed)
ALTER TABLE public.arable_chemical_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chemical library"
  ON public.arable_chemical_library FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 3. Seed data: common UK/EU arable chemicals
-- ---------------------------------------------------------------------------

-- Growth regulators (unique to arable)
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, active_ingredient, is_verified) VALUES
('Chlormequat 720',     ARRAY['CCC 720','Adjust','Manipulator','chlormequat chloride'], 'growth_regulator', 'chlormequat chloride', true),
('Moddus',              ARRAY['trinexapac-ethyl','Moddus Evo'], 'growth_regulator', 'trinexapac-ethyl', true),
('Canopy',              ARRAY['mepiquat chloride + prohexadione'], 'growth_regulator', 'mepiquat chloride + prohexadione-calcium', true),
('Medax Max',           ARRAY['mepiquat chloride + prohexadione-calcium'], 'growth_regulator', 'mepiquat chloride + prohexadione-calcium', true),
('Terpal',              ARRAY['ethephon + mepiquat chloride'], 'growth_regulator', 'ethephon + mepiquat chloride', true);

-- Cereal fungicides
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, active_ingredient, is_verified) VALUES
('Proline',             ARRAY['prothioconazole','Proline 275'], 'fungicide', 'prothioconazole', true),
('Aviator Xpro',       ARRAY['bixafen + prothioconazole'], 'fungicide', 'bixafen + prothioconazole', true),
('Adexar',              ARRAY['epoxiconazole + fluxapyroxad'], 'fungicide', 'epoxiconazole + fluxapyroxad', true),
('Ascra Xpro',         ARRAY['bixafen + fluopyram + prothioconazole'], 'fungicide', 'bixafen + fluopyram + prothioconazole', true),
('Revystar XE',        ARRAY['mefentrifluconazole + fluxapyroxad'], 'fungicide', 'mefentrifluconazole + fluxapyroxad', true),
('Elatus Era',          ARRAY['benzovindiflupyr + prothioconazole'], 'fungicide', 'benzovindiflupyr + prothioconazole', true),
('Imtrex',              ARRAY['fluxapyroxad'], 'fungicide', 'fluxapyroxad', true),
('Siltra Xpro',        ARRAY['bixafen + prothioconazole'], 'fungicide', 'bixafen + prothioconazole', true),
('Amistar',             ARRAY['azoxystrobin','Amistar Opti'], 'fungicide', 'azoxystrobin', true),
('Bravo',               ARRAY['chlorothalonil','Bravo 500'], 'fungicide', 'chlorothalonil', true),
('Fandango',            ARRAY['prothioconazole + fluoxastrobin'], 'fungicide', 'prothioconazole + fluoxastrobin', true),
('Firefly',             ARRAY['difenoconazole + fluxapyroxad'], 'fungicide', 'difenoconazole + fluxapyroxad', true),
('Librax',              ARRAY['fluxapyroxad + metconazole'], 'fungicide', 'fluxapyroxad + metconazole', true),
('Prosaro',             ARRAY['prothioconazole + tebuconazole'], 'fungicide', 'prothioconazole + tebuconazole', true),
('Gleam',               ARRAY['pyraclostrobin + epoxiconazole'], 'fungicide', 'pyraclostrobin + epoxiconazole', true),
('Ceriax',              ARRAY['epoxiconazole + fluxapyroxad + pyraclostrobin'], 'fungicide', 'epoxiconazole + fluxapyroxad + pyraclostrobin', true);

-- Herbicides (pre- and post-emergence)
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, active_ingredient, is_verified) VALUES
('Roundup',             ARRAY['glyphosate','Roundup PowerMax','Roundup ProActive'], 'herbicide', 'glyphosate', true),
('Stomp Aqua',          ARRAY['pendimethalin','Stomp'], 'herbicide', 'pendimethalin', true),
('Crystal',             ARRAY['flufenacet + pendimethalin'], 'herbicide', 'flufenacet + pendimethalin', true),
('Liberator',           ARRAY['flufenacet + diflufenican'], 'herbicide', 'flufenacet + diflufenican', true),
('Atlantis',            ARRAY['mesosulfuron + iodosulfuron','Atlantis Star'], 'herbicide', 'mesosulfuron-methyl + iodosulfuron-methyl', true),
('Pacifica Plus',       ARRAY['mesosulfuron + iodosulfuron + amidosulfuron'], 'herbicide', 'mesosulfuron + iodosulfuron + amidosulfuron', true),
('Axial',               ARRAY['pinoxaden','Axial Pro'], 'herbicide', 'pinoxaden', true),
('Broadway Star',       ARRAY['florasulam + pyroxsulam'], 'herbicide', 'florasulam + pyroxsulam', true),
('Pixxaro',             ARRAY['halauxifen-methyl + fluroxypyr'], 'herbicide', 'halauxifen-methyl + fluroxypyr', true),
('Ally Max SX',        ARRAY['metsulfuron + tribenuron','Ally Max'], 'herbicide', 'metsulfuron-methyl + tribenuron-methyl', true),
('MCPA 750',            ARRAY['MCPA'], 'herbicide', 'MCPA', true),
('Starane XL',         ARRAY['fluroxypyr + florasulam'], 'herbicide', 'fluroxypyr + florasulam', true),
('Hawk',                ARRAY['clodinafop + prosulfocarb'], 'herbicide', 'clodinafop-propargyl + prosulfocarb', true),
('Defy',                ARRAY['prosulfocarb'], 'herbicide', 'prosulfocarb', true);

-- Insecticides
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, active_ingredient, is_verified) VALUES
('Hallmark Zeon',       ARRAY['lambda-cyhalothrin','Hallmark'], 'insecticide', 'lambda-cyhalothrin', true),
('Decis Forte',         ARRAY['deltamethrin','Decis'], 'insecticide', 'deltamethrin', true),
('Mavrik',              ARRAY['tau-fluvalinate'], 'insecticide', 'tau-fluvalinate', true),
('Biscaya',             ARRAY['thiacloprid'], 'insecticide', 'thiacloprid', true),
('Aphox',               ARRAY['pirimicarb'], 'insecticide', 'pirimicarb', true);

-- Seed treatments
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, active_ingredient, is_verified) VALUES
('Redigo Pro',          ARRAY['prothioconazole + tebuconazole'], 'seed_treatment', 'prothioconazole + tebuconazole', true),
('Raxil Star',          ARRAY['tebuconazole + prothioconazole + fluopyram'], 'seed_treatment', 'tebuconazole + prothioconazole + fluopyram', true),
('Vibrance Duo',        ARRAY['sedaxane + fludioxonil'], 'seed_treatment', 'sedaxane + fludioxonil', true),
('Celest Extra',        ARRAY['fludioxonil + cyprodinil'], 'seed_treatment', 'fludioxonil + cyprodinil', true);

-- Fertilisers (common arable foliar feeds and liquid N)
INSERT INTO public.arable_chemical_library (chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified) VALUES
('UAN 28',              ARRAY['UAN','liquid nitrogen 28','N28'], 'fertiliser', 28, 'synthetic_n', 'urea-ammonium nitrate', true),
('UAN 32',              ARRAY['liquid nitrogen 32','N32'], 'fertiliser', 32, 'synthetic_n', 'urea-ammonium nitrate', true),
('Ammonium Nitrate',    ARRAY['AN 34.5','Nitram','prilled AN'], 'fertiliser', 34.5, 'synthetic_n', 'ammonium nitrate', true),
('CAN',                 ARRAY['calcium ammonium nitrate','CAN 27'], 'fertiliser', 27, 'synthetic_n', 'calcium ammonium nitrate', true),
('Urea',                ARRAY['granular urea','prilled urea'], 'fertiliser', 46, 'synthetic_n', 'urea', true),
('Ammonium Sulphate',   ARRAY['AS 21','sulphate of ammonia'], 'fertiliser', 21, 'synthetic_n', 'ammonium sulphate', true),
('Manganese Sulphate',  ARRAY['MnSO4','ManganMax'], 'fertiliser', 0, NULL, 'manganese sulphate', true),
('Epsom Salts',         ARRAY['Bittersalz','MgSO4','magnesium sulphate'], 'fertiliser', 0, NULL, 'magnesium sulphate', true),
('Compost',             ARRAY['green waste compost','mushroom compost'], 'fertiliser', 1, 'organic_compost', NULL, true),
('FYM',                 ARRAY['farmyard manure','muck'], 'fertiliser', 0.6, 'organic_manure', NULL, true),
('Digestate',           ARRAY['AD digestate','anaerobic digestate'], 'fertiliser', 0.5, 'organic_manure', NULL, true);
