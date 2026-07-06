import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, CheckCircle, Check, X, UserX } from "lucide-react";
import { supabase } from "../../utils/supabase/client";

type Availability = "Available" | "Assigned" | "Unavailable";
type Proficiency = "Beginner" | "Intermediate" | "Advanced";

type ProfileRow = {
  id: string;
  user_id: number | null;
  name: string;
  role: string;
  department: string;
  availability: Availability;
  skills: string[];
  proficiency_level: Proficiency;
};

type RankedProfile = ProfileRow & {
  score: number;
  matchedSkills: string[];
  availabilityPriority: number;
};

const DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const defaultSkillOptions = [
  "React",
  "TypeScript",
  "PostgreSQL",
  "Node.js",
  "Python",
  "AWS",
  "Kubernetes",
  "GraphQL",
  "ML/AI",
  "Figma",
  "SQL",
  "Docker",
  "Terraform",
  "Agile",
  "UX Research",
];

const fallbackProfiles: ProfileRow[] = [
  {
    id: "demo-1",
    user_id: 101,
    name: "Ethan Brooks",
    role: "Full Stack Engineer",
    department: "Engineering",
    availability: "Available",
    skills: ["React", "TypeScript", "PostgreSQL", "Node.js", "SQL"],
    proficiency_level: "Advanced",
  },
  {
    id: "demo-2",
    user_id: 102,
    name: "Kavya Desai",
    role: "Frontend Developer",
    department: "Engineering",
    availability: "Available",
    skills: ["React", "TypeScript", "Figma", "UX Research"],
    proficiency_level: "Advanced",
  },
  {
    id: "demo-3",
    user_id: 103,
    name: "Riya Shah",
    role: "Backend Developer",
    department: "Engineering",
    availability: "Assigned",
    skills: ["Node.js", "PostgreSQL", "SQL", "Python"],
    proficiency_level: "Intermediate",
  },
  {
    id: "demo-4",
    user_id: 104,
    name: "Aarav Patel",
    role: "Data Analyst",
    department: "Analytics",
    availability: "Available",
    skills: ["SQL", "Python", "PostgreSQL", "ML/AI"],
    proficiency_level: "Intermediate",
  },
  {
    id: "demo-5",
    user_id: 105,
    name: "Sneha Mehta",
    role: "DevOps Engineer",
    department: "Infrastructure",
    availability: "Available",
    skills: ["AWS", "Docker", "Kubernetes", "Terraform"],
    proficiency_level: "Advanced",
  },
  {
    id: "demo-6",
    user_id: 106,
    name: "Yash Trivedi",
    role: "ML Engineer",
    department: "AI",
    availability: "Assigned",
    skills: ["Python", "ML/AI", "SQL"],
    proficiency_level: "Advanced",
  },
];

function proficiencyRank(level: string) {
  if (level === "Advanced") return 3;
  if (level === "Intermediate") return 2;
  if (level === "Beginner") return 1;
  return 0;
}

function rankToLabel(rank: number): Proficiency {
  if (rank >= 3) return "Advanced";
  if (rank >= 2) return "Intermediate";
  return "Beginner";
}

function normalizeAvailability(row: any): Availability {
  if (typeof row?.availability === "string") {
    const value = row.availability.trim().toLowerCase();
    if (value === "available") return "Available";
    if (value === "assigned") return "Assigned";
    return "Unavailable";
  }

  if (typeof row?.available === "boolean") {
    return row.available ? "Available" : "Assigned";
  }

  return "Unavailable";
}

function normalizeSkillValue(skill: any): string | null {
  if (!skill) return null;

  if (typeof skill === "string") {
    const s = skill.trim();
    return s.length ? s : null;
  }

  if (typeof skill === "object") {
    const value = String(
      skill?.name ??
        skill?.skill_name ??
        skill?.label ??
        skill?.value ??
        skill?.skills?.name ??
        skill?.skill?.name ??
        ""
    ).trim();

    return value.length ? value : null;
  }

  return null;
}

function normalizeProfile(row: any): ProfileRow {
  const employeeSkills = Array.isArray(row?.employee_skills)
    ? row.employee_skills
    : [];

  const directSkills = Array.isArray(row?.skills) ? row.skills : [];

  const mergedSkills = [
    ...directSkills,
    ...employeeSkills.map(
      (item: any) => item?.skills ?? item?.skill ?? item?.name ?? null
    ),
  ];

  const skills = Array.from(
    new Set(
      mergedSkills
        .map(normalizeSkillValue)
        .filter((item: any): item is string => Boolean(item))
    )
  );

  let proficiency_level: Proficiency = "Intermediate";

  if (typeof row?.proficiency_level === "string") {
    const raw = row.proficiency_level.trim().toLowerCase();
    if (raw === "advanced") proficiency_level = "Advanced";
    else if (raw === "intermediate") proficiency_level = "Intermediate";
    else if (raw === "beginner") proficiency_level = "Beginner";
  }

  if (employeeSkills.length > 0) {
    const profValues = employeeSkills
      .map((item: any) => Number(item?.proficiency_level) || 0)
      .filter((n: number) => n > 0);

    if (profValues.length > 0) {
      const avg =
        profValues.reduce((sum: number, value: number) => sum + value, 0) /
        profValues.length;

      proficiency_level = rankToLabel(Math.round(avg));
    }
  }

  let parsedUserId: number | null = null;
  if (
    row?.user_id !== undefined &&
    row?.user_id !== null &&
    row?.user_id !== ""
  ) {
    const n = Number(row.user_id);
    parsedUserId = Number.isFinite(n) ? n : null;
  }

  return {
    id: String(row?.id ?? crypto.randomUUID()),
    user_id: parsedUserId,
    name: String(row?.name ?? "Unknown Employee"),
    role: String(row?.role ?? "Employee"),
    department: String(row?.department ?? "General"),
    availability: normalizeAvailability(row),
    skills,
    proficiency_level,
  };
}

async function fetchSkillOptions(): Promise<string[]> {
  try {
    const result = await supabase.from("skills").select("name").order("name");

    if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
      return Array.from(
        new Set(
          result.data
            .map((row: any) => String(row?.name ?? "").trim())
            .filter(Boolean)
        )
      );
    }

    return defaultSkillOptions;
  } catch {
    return defaultSkillOptions;
  }
}

async function fetchLiveProfiles(): Promise<ProfileRow[]> {
  try {
    const basic = await supabase
      .from("employees")
      .select(
        "id, user_id, name, role, department, available, availability, proficiency_level"
      )
      .limit(300);

    if (basic.error) {
      console.error("Employees fetch error:", basic.error);
      return [];
    }

    if (!Array.isArray(basic.data) || basic.data.length === 0) {
      return [];
    }

    const employeeIds = basic.data.map((row: any) => row.id).filter(Boolean);

    let skillMap = new Map<string, any[]>();

    if (employeeIds.length > 0) {
      const skillsRes = await supabase
        .from("employee_skills")
        .select("employee_id, proficiency_level, skills(name)")
        .in("employee_id", employeeIds)
        .limit(3000);

      if (!skillsRes.error && Array.isArray(skillsRes.data)) {
        skillsRes.data.forEach((item: any) => {
          const current = skillMap.get(item.employee_id) ?? [];
          current.push(item);
          skillMap.set(item.employee_id, current);
        });
      }
    }

    return basic.data.map((row: any) =>
      normalizeProfile({
        ...row,
        employee_skills: skillMap.get(row.id) ?? [],
      })
    );
  } catch (error) {
    console.error("fetchLiveProfiles failed:", error);
    return [];
  }
}

function getAvailabilityPriority(availability: Availability) {
  if (availability === "Available") return 3;
  if (availability === "Assigned") return 2;
  return 1;
}

function calculateMatchScore(
  profile: ProfileRow,
  requiredSkills: string[],
  minProficiency: Proficiency
) {
  const required = requiredSkills.map((s) => s.toLowerCase());
  const profileSkills = profile.skills.map((s) => s.toLowerCase());

  const matchedSkills = required.filter((skill) =>
    profileSkills.includes(skill)
  );
  const skillRatio =
    required.length > 0 ? matchedSkills.length / required.length : 0;

  const profileProf = proficiencyRank(profile.proficiency_level);
  const minProf = proficiencyRank(minProficiency);

  const skillScore = skillRatio * 60;

  let proficiencyScore = 0;
  if (profileProf >= minProf) proficiencyScore = 20;
  else if (profileProf === minProf - 1) proficiencyScore = 8;

  let availabilityScore = 0;
  if (profile.availability === "Available") availabilityScore = 20;
  else if (profile.availability === "Assigned") availabilityScore = 10;
  else availabilityScore = 0;

  const total = skillScore + proficiencyScore + availabilityScore;

  return {
    total,
    matchedSkills,
    availabilityPriority: getAvailabilityPriority(profile.availability),
  };
}

function displayScore(raw: number) {
  return Math.max(55, Math.min(99, Math.round(raw)));
}

export function AIBestFitMatchmaker() {
  const [requirementName, setRequirementName] = useState("Project Requirement");
  const [timeline, setTimeline] = useState<"3" | "6" | "12">("3");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([
    "React",
    "TypeScript",
    "PostgreSQL",
  ]);
  const [minProficiency, setMinProficiency] =
    useState<Proficiency>("Intermediate");

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [skillOptions, setSkillOptions] =
    useState<string[]>(defaultSkillOptions);
  const [results, setResults] = useState<RankedProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedEmployees, setAssignedEmployees] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [fetchedProfiles, fetchedSkills] = await Promise.all([
          fetchLiveProfiles(),
          fetchSkillOptions(),
        ]);

        if (fetchedProfiles.length > 0) {
          setProfiles(fetchedProfiles);
          setUsingFallback(false);
        } else {
          // fallback so button stays usable and UI still works
          setProfiles(fallbackProfiles);
          setUsingFallback(true);
        }

        setSkillOptions(
          fetchedSkills.length > 0 ? fetchedSkills : defaultSkillOptions
        );
      } catch (err: any) {
        console.error(err);
        setProfiles(fallbackProfiles);
        setUsingFallback(true);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleToggleSkill = (skill: string) => {
    setRequiredSkills((current) =>
      current.includes(skill)
        ? current.filter((item) => item !== skill)
        : [...current, skill]
    );
  };

  const handleFindBestFit = () => {
    setSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const ranked = profiles
        .map((profile) => {
          const { total, matchedSkills, availabilityPriority } =
            calculateMatchScore(profile, requiredSkills, minProficiency);

          return {
            ...profile,
            score: displayScore(total),
            matchedSkills,
            availabilityPriority,
          } as RankedProfile;
        })
        .sort((a, b) => {
          if (b.availabilityPriority !== a.availabilityPriority) {
            return b.availabilityPriority - a.availabilityPriority;
          }

          if (b.score !== a.score) {
            return b.score - a.score;
          }

          if (b.matchedSkills.length !== a.matchedSkills.length) {
            return b.matchedSkills.length - a.matchedSkills.length;
          }

          const profDiff =
            proficiencyRank(b.proficiency_level) -
            proficiencyRank(a.proficiency_level);

          if (profDiff !== 0) return profDiff;

          return a.name.localeCompare(b.name);
        })
        .slice(0, 5);

      setResults(ranked);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to rank candidates.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDeclineEmployee = (profile: RankedProfile) => {
    setResults((prev) => prev.filter((p) => p.id !== profile.id));
  };

  const handleAssignEmployee = async (profile: RankedProfile) => {
    setAssigning(profile.id);

    try {
      // fallback mode => don't insert DB, only simulate success
      if (usingFallback || profile.id.startsWith("demo-")) {
        setAssignedEmployees((prev) => new Set([...prev, profile.id]));
        setResults((prev) =>
          prev.map((item) =>
            item.id === profile.id
              ? { ...item, availability: "Assigned", availabilityPriority: 2 }
              : item
          )
        );
        alert(`✓ ${profile.name} assigned successfully (demo mode)`);
        return;
      }

      if (profile.user_id === null || profile.user_id === undefined) {
        throw new Error(
          `Employee "${profile.name}" does not have a valid numeric user_id in employees table.`
        );
      }

      if (!Number.isFinite(profile.user_id)) {
        throw new Error(
          `Employee "${profile.name}" has invalid user_id. assignments.user_id expects bigint/number.`
        );
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + parseInt(timeline, 10));

      const insertAssignment = await supabase.from("assignments").insert([
        {
          user_id: profile.user_id,
          project_id: DEFAULT_PROJECT_ID,
          role: `${profile.role} - ${requirementName}`,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          status: "active",
        },
      ]);

      if (insertAssignment.error) {
        throw new Error(insertAssignment.error.message);
      }

      const updateEmployee = await supabase
        .from("employees")
        .update({
          available: false,
          availability: "Assigned",
        })
        .eq("id", profile.id);

      if (updateEmployee.error) {
        console.warn(
          "Employee availability update failed:",
          updateEmployee.error
        );
      }

      setAssignedEmployees((prev) => new Set([...prev, profile.id]));

      setResults((prev) =>
        prev.map((item) =>
          item.id === profile.id
            ? { ...item, availability: "Assigned", availabilityPriority: 2 }
            : item
        )
      );

      alert(`✓ ${profile.name} assigned successfully`);
    } catch (err: any) {
      console.error("Assignment failed:", err);
      alert(`Assignment failed: ${err?.message || "Unknown error"}`);
    } finally {
      setAssigning(null);
    }
  };

  const summaryText = useMemo(() => {
    if (error) return error;
    if (loading) return "Loading employee profiles...";

    if (usingFallback) {
      return 'Live employees could not be loaded from Supabase, so demo employee data is being used. "Find Best Fit" and Assign will still work for UI demo.';
    }

    if (profiles.length === 0) {
      return "No employees found in the employees table.";
    }

    if (results.length === 0) {
      return `Loaded ${profiles.length} employee profiles. Click "Find Best Fit" to see the top 5 candidates.`;
    }

    return `Showing top ${results.length} ranked candidates for "${requirementName}". Available employees are prioritized first.`;
  }, [error, loading, profiles.length, results.length, requirementName, usingFallback]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          AI Best-Fit Matchmaker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Match the top 5 employees to a requirement using skills, proficiency,
          and availability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Requirement Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Requirement Name
                </label>
                <input
                  value={requirementName}
                  onChange={(e) => setRequirementName(e.target.value)}
                  placeholder="e.g. Project Nexus - Phase 2"
                  className="mt-2 w-full rounded-xl border-2 border-blue-300 bg-white px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Timeline
                </label>
                <select
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value as "3" | "6" | "12")}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Required Skills
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {requiredSkills.length} selected
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {skillOptions.slice(0, 24).map((skill) => {
                    const active = requiredSkills.includes(skill);

                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleToggleSkill(skill)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-[#1B3A8F] border-[#1B3A8F] text-white"
                            : "bg-background border-border text-muted-foreground hover:border-slate-300"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Minimum Proficiency
                </label>
                <select
                  value={minProficiency}
                  onChange={(e) => setMinProficiency(e.target.value as Proficiency)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="Advanced">Advanced</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Beginner">Beginner</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFindBestFit}
              disabled={loading || searching}
              className="mt-5 w-full rounded-2xl bg-[#1B3A8F] px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? "Finding best fit..." : "Find Best Fit"}
            </button>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <CheckCircle className="h-4 w-4" />
              AI Analysis
            </div>
            <p>{summaryText}</p>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              Loading candidate profiles…
            </div>
          ) : results.length === 0 && !hasSearched ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Top 5 matches will appear here
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Click Find Best Fit to rank employees.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                No matches found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try broader skills or lower minimum proficiency.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Top 5 Matches — {requirementName || "Requirement"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Available employees are ranked first, then assigned employees.
                  </p>
                </div>

                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {results.length} results
                </span>
              </div>

              {results.map((profile, index) => {
                const scoreColor =
                  profile.score >= 92
                    ? "text-emerald-600"
                    : profile.score >= 85
                    ? "text-sky-700"
                    : "text-slate-800";

                const availabilityClass =
                  profile.availability === "Available"
                    ? "bg-emerald-100 text-emerald-700"
                    : profile.availability === "Assigned"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-rose-100 text-rose-700";

                const canAssign =
                  profile.user_id !== null &&
                  profile.user_id !== undefined &&
                  profile.availability !== "Unavailable";

                return (
                  <div
                    key={profile.id}
                    className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1B3A8F] text-sm font-semibold text-white shadow-sm">
                          {profile.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                              #{index + 1}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Match candidate
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-foreground">
                            {profile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profile.role} · {profile.department}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-2xl font-bold ${scoreColor}`}>
                          {profile.score}%
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          match
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1B3A8F] to-blue-400 transition-all"
                        style={{ width: `${profile.score}%` }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {profile.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                        >
                          {skill}
                        </span>
                      ))}

                      {profile.matchedSkills.length === 0 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          General fit
                        </span>
                      )}

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${availabilityClass}`}
                      >
                        {profile.availability}
                      </span>

                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                        {profile.proficiency_level}
                      </span>
                    </div>

                    {!assignedEmployees.has(profile.id) ? (
                      <div className="mt-5 flex gap-2">
                        <button
                          onClick={() => handleAssignEmployee(profile)}
                          disabled={assigning === profile.id || !canAssign}
                          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
                        >
                          {assigning === profile.id ? (
                            <>
                              <span className="animate-spin">⟳</span> Assigning...
                            </>
                          ) : canAssign ? (
                            <>
                              <Check className="w-4 h-4" /> Assign
                            </>
                          ) : (
                            <>Assign Unavailable</>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeclineEmployee(profile)}
                          disabled={assigning === profile.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg transition"
                        >
                          <X className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">
                          Assigned
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}