/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useForm, Controller, FieldValues, UseFormRegister, Control, UseFormWatch, UseFormTrigger } from "react-hook-form";
import { INDIA_STATES } from "../../utils/indiaStates";
import { GenerateEstimatePayload, ProjectType } from "./estimateApi";

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "ROAD", label: "Road / Highway" },
  { value: "BRIDGE", label: "Bridge / Culvert" },
  { value: "BUILDING", label: "Building / Structure" },
  { value: "DRAINAGE", label: "Drainage / Sewerage" }
];

const CURRENT_YEAR = new Date().getFullYear();
const FY_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = CURRENT_YEAR - 2 + i;
  return { value: `${y}-${String(y + 1).slice(2)}`, label: `${y}-${String(y + 1).slice(2)}` };
});

interface StepProps {
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues, any>;
  errors: Record<string, { message?: string }>;
  watch: UseFormWatch<FieldValues>;
  stateDistricts?: Record<string, { value: string; label: string }[]>;
}

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {children}{required === true && <span className="ml-1 text-red-500">*</span>}
  </label>
);

const FieldError = ({ msg }: { msg: string | undefined }) =>
  msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-casper-blue focus:outline-none focus:ring-1 focus:ring-casper-blue dark:border-slate-700 dark:bg-slate-800 dark:text-white";

function NumberInput({ label, name, register, errors, required, min, step, placeholder }: {
  label: string; name: string;
  register: UseFormRegister<FieldValues>;
  errors: Record<string, { message?: string }>;
  required?: boolean; min?: number; step?: number; placeholder?: string;
}) {
  const rules: Record<string, unknown> = {};
  if (required) rules.required = `${label} is required`;
  if (min !== undefined) rules.min = { value: min, message: `Minimum is ${min}` };
  return (
    <div>
      <Label required={required === true}>{label}</Label>
      <input
        type="number"
        step={step ?? "any"}
        min={min ?? 0}
        placeholder={placeholder}
        {...register(name, rules)}
        className={inputCls}
      />
      <FieldError msg={errors[name]?.message} />
    </div>
  );
}

function SelectInput({ label, name, options, register, errors, required }: {
  label: string; name: string;
  options: { value: string; label: string }[];
  register: UseFormRegister<FieldValues>;
  errors: Record<string, { message?: string }>;
  required?: boolean;
}) {
  const rules: Record<string, unknown> = {};
  if (required) rules.required = `${label} is required`;
  return (
    <div>
      <Label required={required === true}>{label}</Label>
      <select {...register(name, rules)} className={inputCls}>
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError msg={errors[name]?.message} />
    </div>
  );
}

function CommonStep({ register, errors, control, watch, stateDistricts }: StepProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label required>Project Name</Label>
        <input
          type="text"
          placeholder="e.g. NH-44 Widening Dimapur to Kohima"
          {...register("project_name", { required: "Project name is required", minLength: { value: 2, message: "Min 2 chars" } })}
          className={inputCls}
        />
        <FieldError msg={errors["project_name"]?.message} />
      </div>

      <SelectInput label="State" name="state" options={INDIA_STATES.map(s => ({ value: s.value, label: s.label }))} register={register} errors={errors} required />

      <div>
        <Label required>District</Label>
        <select {...register("district", { required: "District is required" })} className={inputCls}>
          <option value="">— Select —</option>
          {(stateDistricts?.[(watch("state") as string) ?? ""] ?? []).map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <FieldError msg={errors["district"]?.message} />
      </div>

      <SelectInput label="Financial Year" name="financial_year" options={FY_OPTIONS} register={register} errors={errors} required />

      <div className="sm:col-span-2">
        <Label required>Project Type</Label>
        <Controller
          name="project_type"
          control={control}
          rules={{ required: "Select a project type" }}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => field.onChange(pt.value)}
                  className={`rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors ${
                    field.value === pt.value
                      ? "border-casper-blue bg-casper-blue/10 text-casper-blue dark:bg-casper-blue/20"
                      : "border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          )}
        />
        <FieldError msg={errors["project_type"]?.message} />
      </div>
    </div>
  );
}

function RoadFields({ register, errors }: StepProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NumberInput label="Length (km)" name="length_km" register={register} errors={errors} required min={0.1} />
      <div>
        <Label required>Width (m)</Label>
        <select {...register("width_m", { required: "Width is required" })} className={inputCls}>
          <option value="">— Select —</option>
          <option value="3.75">3.75 m — Single Lane</option>
          <option value="7">7 m — Double Lane</option>
          <option value="14">14 m — 4-Lane</option>
          <option value="21">21 m — 6-Lane</option>
        </select>
        <FieldError msg={errors["width_m"]?.message} />
      </div>
      <SelectInput label="Road Type" name="road_type" options={[{value:"NH",label:"NH — National Highway"},{value:"SH",label:"SH — State Highway"},{value:"MDR",label:"MDR — Major District Road"},{value:"Rural",label:"Rural Road"}]} register={register} errors={errors} required />
      <SelectInput label="Surface Type" name="surface_type" options={[{value:"Bituminous",label:"Bituminous"},{value:"Concrete",label:"Concrete"},{value:"WBM",label:"WBM"},{value:"Gravel",label:"Gravel"}]} register={register} errors={errors} required />
      <SelectInput label="Terrain" name="terrain" options={[{value:"Plain",label:"Plain"},{value:"Rolling",label:"Rolling"},{value:"Hilly",label:"Hilly"},{value:"Steep",label:"Steep"}]} register={register} errors={errors} required />
      <SelectInput label="Subgrade Soil" name="subgrade_soil" options={[{value:"Good",label:"Good"},{value:"Medium",label:"Medium"},{value:"Poor",label:"Poor"}]} register={register} errors={errors} required />
      <NumberInput label="Embankment Height (m)" name="embankment_height_m" register={register} errors={errors} min={0} placeholder="0" />
      <NumberInput label="Number of Culverts" name="num_culverts" register={register} errors={errors} min={0} step={1} placeholder="0" />
      <NumberInput label="Number of Minor Bridges" name="num_minor_bridges" register={register} errors={errors} min={0} step={1} placeholder="0" />
      <SelectInput label="Drainage Type" name="drainage_type" options={[{value:"None",label:"None"},{value:"Open drain",label:"Open Drain"},{value:"Covered drain",label:"Covered Drain"},{value:"Both",label:"Both"}]} register={register} errors={errors} required />
    </div>
  );
}

function BridgeFields({ register, errors }: StepProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NumberInput label="Total Length (m)" name="total_length_m" register={register} errors={errors} required min={1} />
      <NumberInput label="Width (m)" name="width_m" register={register} errors={errors} required min={1} />
      <NumberInput label="Number of Spans" name="num_spans" register={register} errors={errors} required min={1} step={1} />
      <NumberInput label="Span Length (m)" name="span_length_m" register={register} errors={errors} required min={1} />
      <SelectInput label="Bridge Type" name="bridge_type" options={[{value:"RCC Slab",label:"RCC Slab"},{value:"PSC Girder",label:"PSC Girder"},{value:"Steel Truss",label:"Steel Truss"},{value:"Cable-Stayed",label:"Cable-Stayed"}]} register={register} errors={errors} required />
      <SelectInput label="Foundation Type" name="foundation_type" options={[{value:"Open",label:"Open Foundation"},{value:"Pile",label:"Pile Foundation"},{value:"Well",label:"Well Foundation"}]} register={register} errors={errors} required />
      <SelectInput label="River Bed Material" name="river_bed_material" options={[{value:"Soil",label:"Soil"},{value:"Rock",label:"Rock"},{value:"Mixed",label:"Mixed"}]} register={register} errors={errors} required />
      <NumberInput label="Max Flood Discharge (cumecs)" name="max_flood_discharge" register={register} errors={errors} placeholder="Optional" />
      <NumberInput label="Approach Road Length (m)" name="approach_road_length_m" register={register} errors={errors} min={0} placeholder="0" />
    </div>
  );
}

function BuildingFields({ register, errors }: StepProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectInput label="Building Type" name="building_type" options={[{value:"Residential",label:"Residential"},{value:"Office",label:"Office"},{value:"Hospital",label:"Hospital"},{value:"School",label:"School"},{value:"Other",label:"Other"}]} register={register} errors={errors} required />
      <NumberInput label="Number of Floors" name="num_floors" register={register} errors={errors} required min={1} step={1} />
      <NumberInput label="Plinth Area per Floor (sq.m)" name="plinth_area_per_floor_sqm" register={register} errors={errors} required min={10} />
      <SelectInput label="Construction Type" name="construction_type" options={[{value:"Load-bearing",label:"Load-bearing"},{value:"RCC Frame",label:"RCC Frame"},{value:"Steel Frame",label:"Steel Frame"}]} register={register} errors={errors} required />
      <SelectInput label="Finishing Level" name="finishing_level" options={[{value:"Basic",label:"Basic"},{value:"Standard",label:"Standard"},{value:"Premium",label:"Premium"}]} register={register} errors={errors} required />
      <SelectInput label="Site Condition" name="site_condition" options={[{value:"Plain",label:"Plain"},{value:"Sloped",label:"Sloped"}]} register={register} errors={errors} required />
      <NumberInput label="Number of Toilets" name="num_toilets" register={register} errors={errors} min={0} step={1} placeholder="0" />
      <NumberInput label="Number of Lifts" name="num_lifts" register={register} errors={errors} min={0} step={1} placeholder="0" />
      <NumberInput label="Number of Staircases" name="num_staircases" register={register} errors={errors} min={1} step={1} placeholder="1" />
    </div>
  );
}

function DrainageFields({ register, errors, watch, control }: StepProps) {
  const hasTreatment = watch("treatment_plant_required") as boolean | undefined;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NumberInput label="Network Length (km)" name="network_length_km" register={register} errors={errors} required min={0.1} />
      <div>
        <Label required>Pipe Diameter Min (mm)</Label>
        <input type="range" min={100} max={1200} step={50} {...register("pipe_diameter_min_mm", { required: true })} className="w-full" />
        <div className="mt-1 text-right text-xs text-slate-500">{(watch("pipe_diameter_min_mm") as number | undefined) ?? 100} mm</div>
      </div>
      <div>
        <Label required>Pipe Diameter Max (mm)</Label>
        <input type="range" min={100} max={1200} step={50} {...register("pipe_diameter_max_mm", { required: true })} className="w-full" defaultValue={600} />
        <div className="mt-1 text-right text-xs text-slate-500">{(watch("pipe_diameter_max_mm") as number | undefined) ?? 600} mm</div>
      </div>
      <SelectInput label="Pipe Material" name="pipe_material" options={[{value:"RCC",label:"RCC"},{value:"DI",label:"Ductile Iron (DI)"},{value:"HDPE",label:"HDPE"},{value:"PVC",label:"PVC"}]} register={register} errors={errors} required />
      <NumberInput label="Depth of Laying (m)" name="depth_of_laying_m" register={register} errors={errors} required min={0.5} />
      <SelectInput label="Terrain / Area" name="terrain" options={[{value:"Urban",label:"Urban"},{value:"Semi-urban",label:"Semi-urban"},{value:"Rural",label:"Rural"}]} register={register} errors={errors} required />
      <NumberInput label="Number of Manholes" name="num_manholes" register={register} errors={errors} min={0} step={1} placeholder="0" />
      <div>
        <Label>Treatment Plant Required</Label>
        <Controller
          name="treatment_plant_required"
          control={control}
          defaultValue={false}
          render={({ field }) => (
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              className={`mt-1 flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                field.value
                  ? "border-casper-blue bg-casper-blue/10 text-casper-blue"
                  : "border-slate-300 text-slate-600 dark:border-slate-700"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full border-2 ${field.value ? "border-casper-blue bg-casper-blue" : "border-slate-400"}`} />
              {field.value ? "Yes" : "No"}
            </button>
          )}
        />
      </div>
      {hasTreatment && (
        <NumberInput label="Treatment Capacity (MLD)" name="treatment_capacity_mld" register={register} errors={errors} min={0.1} />
      )}
    </div>
  );
}

const STEP_FIELDS_BY_TYPE: Record<ProjectType, (props: StepProps) => JSX.Element> = {
  ROAD: RoadFields,
  BRIDGE: BridgeFields,
  BUILDING: BuildingFields,
  DRAINAGE: DrainageFields
};

interface EstimateFormProps {
  onSubmit: (data: GenerateEstimatePayload) => void;
  isLoading: boolean;
}

export function EstimateForm({ onSubmit, isLoading }: EstimateFormProps): JSX.Element {
  const [step, setStep] = useState(0);
  const { register, handleSubmit, control, watch, formState: { errors }, trigger } = useForm<FieldValues>({
    defaultValues: { embankment_height_m: 0, num_culverts: 0, num_minor_bridges: 0, pipe_diameter_min_mm: 100, pipe_diameter_max_mm: 600, num_toilets: 0, num_lifts: 0, num_staircases: 1, num_manholes: 0, approach_road_length_m: 0, treatment_plant_required: false }
  });

  const projectType = watch("project_type") as ProjectType | undefined;
  const totalSteps = projectType ? 3 : 2;

  const [stateDistricts, setStateDistricts] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    let mounted = true;
    fetch("/api/analytics/states")
      .then((r) => r.json())
      .then((payload) => {
        const data = payload?.data ?? [];
        if (!mounted) return;
        const map: Record<string, { value: string; label: string }[]> = {};
        for (const s of data) {
          const key = String(s.name).toLowerCase();
          map[key] = (s.districts ?? []).map((d: { name: string }) => ({ value: d.name, label: d.name }));
        }
        setStateDistricts(map);
      })
      .catch(() => {
        /* ignore errors - districts will remain empty */
      });
    return () => { mounted = false; };
  }, []);

  const goNext = async () => {
    const fieldsToValidate: string[] = step === 0
      ? ["project_name", "state", "district", "financial_year", "project_type"]
      : [];
    const valid = fieldsToValidate.length === 0 || await (trigger as UseFormTrigger<FieldValues>)(fieldsToValidate);
    if (valid) setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const TypeFields = projectType ? STEP_FIELDS_BY_TYPE[projectType] : null;

  const steps = [
    { label: "Project Info" },
    { label: projectType ?? "Details" },
    { label: "Review & Generate" }
  ].slice(0, totalSteps);

  const formData = watch();

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as GenerateEstimatePayload))} className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-1 items-center gap-1">
            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i < step ? "bg-casper-blue text-white" : i === step ? "border-2 border-casper-blue text-casper-blue" : "border-2 border-slate-300 text-slate-400"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-casper-blue" : "text-slate-400"} hidden sm:inline`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < step ? "bg-casper-blue" : "bg-slate-200 dark:bg-slate-700"}`} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {step === 0 && (
          <CommonStep register={register} control={control} errors={errors as Record<string, { message?: string }>} watch={watch} stateDistricts={stateDistricts} />
        )}
        {step === 1 && TypeFields && (
          <TypeFields register={register} control={control} errors={errors as Record<string, { message?: string }>} watch={watch} />
        )}
        {step === totalSteps - 1 && step > 0 && (
          <ReviewStep data={formData} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ← Back
        </button>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-casper-blue px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-casper-blue px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating…
              </>
            ) : (
              "Generate Estimate"
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewStep({ data }: { data: FieldValues }) {
  const skip = new Set(["project_name", "district", "state", "financial_year", "project_type"]);
  const entries = Object.entries(data).filter(([k, v]) => !skip.has(k) && v !== undefined && v !== "" && v !== null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
        <h3 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">Project Info</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Row label="Name" value={String(data["project_name"] ?? "")} />
          <Row label="Type" value={String(data["project_type"] ?? "")} />
          <Row label="State" value={String(data["state"] ?? "")} />
          <Row label="District" value={String(data["district"] ?? "")} />
          <Row label="Financial Year" value={String(data["financial_year"] ?? "")} />
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
        <h3 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">Project Parameters</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {entries.map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, " ")} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)} />
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500">Review all parameters above, then click Generate to get your estimate.</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="capitalize text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
    </>
  );
}
