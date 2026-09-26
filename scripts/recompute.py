#!/usr/bin/env python3
"""
Rekalkulasi independen hasil DCGMI.

Memenuhi R1-V1.7 §3.14 dan Tabel 3.10: jejak komputasional harus dapat
diperiksa ulang. Skrip ini ditulis terpisah dari implementasi TypeScript
dan TIDAK boleh mengimpor apa pun darinya. Perbedaan hasil di atas
toleransi adalah bug yang memblokir rilis.

Pakai:
  python scripts/recompute.py export.json --check
  python scripts/recompute.py export.json --report laporan.json
  python scripts/recompute.py --self-test
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys

import numpy as np

TOLERANCE = 1e-6
I_CVI_MIN = 0.78
I_CVI_REVISE_MIN = 0.50
S_CVI_AVE_MIN = 0.90
MEDIAN_MIN = 3
IQR_MAX = 1
CR_MAX = 0.10
RANDOM_INDEX = [0.0, 0.0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49]


# ── Delphi / CVI ──────────────────────────────────────────────────────
def item_cvi(ratings: list[int | None]) -> dict:
    valid = [r for r in ratings if r is not None]
    if not valid:
        raise ValueError("tidak ada penilai valid")
    arr = np.array(valid, dtype=float)
    relevant = int(np.sum((arr == 3) | (arr == 4)))
    return {
        "iCvi": relevant / len(valid),
        # linear = tipe 7, default R/NumPy. Definisi ini dikunci di docs/05.
        "median": float(np.percentile(arr, 50, method="linear")),
        "iqr": float(
            np.percentile(arr, 75, method="linear") - np.percentile(arr, 25, method="linear")
        ),
        "validRaters": len(valid),
    }


def decide_item(m: dict, *, clarity_critical=False, construct_conflict=False, rnd=1) -> str:
    if construct_conflict or m["iCvi"] < I_CVI_REVISE_MIN:
        return "HAPUS_DARI_INTI"
    if (
        m["iCvi"] >= I_CVI_MIN
        and m["median"] >= MEDIAN_MIN
        and m["iqr"] <= IQR_MAX
        and not clarity_critical
    ):
        return "PERTAHANKAN"
    return "TIDAK_SELESAI" if rnd >= 3 else "REVISI_NILAI_ULANG"


def scale_cvi(i_cvis: list[float]) -> dict:
    ave = float(np.mean(i_cvis))
    return {"sCviAve": ave, "passes": ave >= S_CVI_AVE_MIN}


# ── AHP ───────────────────────────────────────────────────────────────
def priority_vector(matrix: list[list[float]]) -> dict:
    A = np.array(matrix, dtype=float)
    n = A.shape[0]
    if A.shape[0] != A.shape[1]:
        raise ValueError("matriks harus persegi")
    if not np.allclose(A * A.T, 1.0, atol=1e-9):
        raise ValueError("matriks tidak resiprokal")

    w = np.full(n, 1.0 / n)
    for _ in range(1000):
        nw = A @ w
        nw = nw / nw.sum()
        if np.abs(nw - w).max() < 1e-12:
            w = nw
            break
        w = nw

    lam = float(np.mean((A @ w) / w))
    ci = (lam - n) / (n - 1) if n > 1 else 0.0
    ri = RANDOM_INDEX[n - 1] if n <= len(RANDOM_INDEX) else 0.0
    cr = 0.0 if n <= 2 or ri == 0 else ci / ri
    return {
        "weights": w.tolist(),
        "lambdaMax": lam,
        "ci": ci,
        "cr": cr,
        "accepted": cr < CR_MAX,
    }


def aggregate_geometric(matrices: list[list[list[float]]]) -> dict:
    accepted = [m for m in matrices if priority_vector(m)["accepted"]]
    if not accepted:
        raise ValueError("tidak ada matriks dengan CR < 0,10")
    stack = np.array(accepted, dtype=float)
    agg = np.exp(np.mean(np.log(stack), axis=0))
    out = priority_vector(agg.tolist())
    out["aggregatedMatrix"] = agg.tolist()
    out["included"] = len(accepted)
    return out


# ── Penskoran ─────────────────────────────────────────────────────────
def aspect_score(indicators: list[dict]) -> float | None:
    if any(i.get("missingKind") == "MISSING_ADMINISTRATIF" for i in indicators):
        return None  # menahan skor; tidak ada imputasi
    levels = [i["level"] for i in indicators]
    return float(np.mean(levels))


def compute_index(domains: list[dict]) -> dict:
    profile: dict[str, float | None] = {}
    composite: float | None = 0.0

    weights = [d["weight"] for d in domains]
    if abs(sum(weights) - 1.0) > 1e-9:
        raise ValueError(f"jumlah bobot domain {sum(weights)}, seharusnya 1")

    for d in domains:
        local = [a["localWeight"] for a in d["aspects"]]
        if abs(sum(local) - 1.0) > 1e-9:
            raise ValueError(f"bobot aspek {d['domainCode']} tidak berjumlah 1")
        total, blocked = 0.0, False
        for a in d["aspects"]:
            s = aspect_score(a["indicators"])
            if s is None:
                blocked = True
            else:
                total += a["localWeight"] * s
        profile[d["domainCode"]] = None if blocked else total
        if blocked:
            composite = None
        elif composite is not None:
            composite += d["weight"] * total

    return {"domainProfile": profile, "composite": composite, "compositeStatus": "PROVISIONAL"}


# ── Pemeriksaan silang ────────────────────────────────────────────────
def compare(export: dict) -> list[str]:
    diffs: list[str] = []

    for item in export.get("delphiItems", []):
        mine = item_cvi(item["ratings"])
        for key in ("iCvi", "median", "iqr"):
            if abs(mine[key] - item["reported"][key]) > TOLERANCE:
                diffs.append(f"{item['indicatorCode']}.{key}: app={item['reported'][key]} py={mine[key]}")
        if mine["validRaters"] != item["reported"]["validRaters"]:
            diffs.append(f"{item['indicatorCode']}.validRaters berbeda")
        d = decide_item(
            mine,
            clarity_critical=item.get("clarityCritical", False),
            construct_conflict=item.get("constructConflict", False),
            rnd=item.get("round", 1),
        )
        if d != item["reported"]["decision"]:
            diffs.append(f"{item['indicatorCode']}.decision: app={item['reported']['decision']} py={d}")

    for m in export.get("ahpMatrices", []):
        mine = priority_vector(m["cells"])
        for key in ("lambdaMax", "ci", "cr"):
            if abs(mine[key] - m["reported"][key]) > TOLERANCE:
                diffs.append(f"matriks kursi {m['seatIndex']}.{key}: app={m['reported'][key]} py={mine[key]}")
        for i, w in enumerate(mine["weights"]):
            if abs(w - m["reported"]["weights"][i]) > TOLERANCE:
                diffs.append(f"matriks kursi {m['seatIndex']}.w[{i}] berbeda")

    for g in export.get("ahpAggregates", []):
        mine = aggregate_geometric(g["matrices"])
        for i, w in enumerate(mine["weights"]):
            if abs(w - g["reported"]["weights"][i]) > TOLERANCE:
                diffs.append(f"agregat {g['group']}.w[{i}]: app={g['reported']['weights'][i]} py={w}")
        if mine["included"] != g["reported"]["included"]:
            diffs.append(f"agregat {g['group']}: jumlah matriks diikutkan berbeda")

    for a in export.get("assessments", []):
        mine = compute_index(a["domains"])
        rep = a["reported"]
        if (mine["composite"] is None) != (rep["composite"] is None):
            diffs.append(f"asesmen {a['id']}: status komposit berbeda")
        elif mine["composite"] is not None and abs(mine["composite"] - rep["composite"]) > TOLERANCE:
            diffs.append(f"asesmen {a['id']}.composite: app={rep['composite']} py={mine['composite']}")
        for code, val in mine["domainProfile"].items():
            other = rep["domainProfile"].get(code)
            if (val is None) != (other is None):
                diffs.append(f"asesmen {a['id']}.{code}: status berbeda")
            elif val is not None and abs(val - other) > TOLERANCE:
                diffs.append(f"asesmen {a['id']}.{code}: app={other} py={val}")

    return diffs


def check(export: dict) -> int:
    diffs = compare(export)
    if diffs:
        print("PERBEDAAN DITEMUKAN:", file=sys.stderr)
        for d in diffs:
            print(f"  x {d}", file=sys.stderr)
        return 1
    print(f"OK — rekalkulasi identik dalam toleransi {TOLERANCE}.")
    return 0


def self_test() -> int:
    """Vector yang sama dengan docs/05-METHOD-RULES.md."""
    failures: list[str] = []

    cvi_cases = [
        ("C1", [4, 4, 4, 4, 4, 3, 3, 3], 1.0, 4.0, 1.0, "PERTAHANKAN"),
        ("C2", [4, 4, 4, 4, 4, 4, 4, 2], 0.875, 4.0, 0.0, "PERTAHANKAN"),
        ("C3", [4, 4, 4, 4, 4, 4, 2, 2], 0.75, 4.0, 0.5, "REVISI_NILAI_ULANG"),
        ("C4", [4, 4, 3, 3, 2, 2, 2, 2], 0.5, 2.5, 1.25, "REVISI_NILAI_ULANG"),
        ("C5", [3, 2, 2, 2, 2, 1, 1, 1], 0.125, 2.0, 1.0, "HAPUS_DARI_INTI"),
        ("C6", [4, 4, 4, 4, 1, 1, 1, 1], 0.5, 2.5, 3.0, "REVISI_NILAI_ULANG"),
    ]
    for name, r, icvi, med, spread, dec in cvi_cases:
        m = item_cvi(r)
        if abs(m["iCvi"] - icvi) > TOLERANCE: failures.append(f"{name}.iCvi={m['iCvi']}")
        if abs(m["median"] - med) > TOLERANCE: failures.append(f"{name}.median={m['median']}")
        if abs(m["iqr"] - spread) > TOLERANCE: failures.append(f"{name}.iqr={m['iqr']}")
        if decide_item(m) != dec: failures.append(f"{name}.decision={decide_item(m)}")

    c7 = item_cvi([4, 4, 4, 4, 4, 4, 4, None])
    if c7["validRaters"] != 7: failures.append("C7.validRaters bukan 7")

    s = scale_cvi([1.0, 0.875, 0.875, 1.0, 0.75])
    if abs(s["sCviAve"] - 0.9) > TOLERANCE or not s["passes"]: failures.append("S-CVI 0,90 tidak lolos")

    a1 = priority_vector([[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]])
    if abs(a1["weights"][0] - 0.571429) > TOLERANCE: failures.append("A1.w0")
    if abs(a1["cr"]) > TOLERANCE: failures.append("A1.cr")

    a2 = priority_vector([[1, 3, 5], [1/3, 1, 3], [1/5, 1/3, 1]])
    for i, exp in enumerate([0.636986, 0.258285, 0.104729]):
        if abs(a2["weights"][i] - exp) > TOLERANCE: failures.append(f"A2.w{i}={a2['weights'][i]}")
    if abs(a2["cr"] - 0.033199) > TOLERANCE: failures.append(f"A2.cr={a2['cr']}")

    a3 = priority_vector([[1, 9, 1/5], [1/9, 1, 3], [5, 1/3, 1]])
    if a3["accepted"]: failures.append("A3 seharusnya ditolak")

    a5 = aggregate_geometric([[[1, 3], [1/3, 1]], [[1, 5], [1/5, 1]]])
    if abs(a5["aggregatedMatrix"][0][1] - 15 ** 0.5) > TOLERANCE: failures.append("A5 agregasi geometris")

    mk = lambda code, w, lvl: {
        "domainCode": code, "weight": w,
        "aspects": [{"localWeight": 1.0, "indicators": [{"level": lvl, "missingKind": "NONE"}]}],
    }
    s2 = compute_index([mk("D1", 0.5, 3), mk("D2", 0.3, 2), mk("D3", 0.2, 4)])
    if abs(s2["composite"] - 2.9) > TOLERANCE: failures.append(f"S2.composite={s2['composite']}")

    s3 = compute_index([{
        "domainCode": "D1", "weight": 1.0,
        "aspects": [{"localWeight": 1.0, "indicators": [
            {"level": 4, "missingKind": "NONE"},
            {"level": None, "missingKind": "MISSING_ADMINISTRATIF"},
            {"level": 3, "missingKind": "NONE"}]}],
    }])
    if s3["composite"] is not None: failures.append("S3 seharusnya null")

    if failures:
        print("SELF-TEST GAGAL:", file=sys.stderr)
        for f in failures:
            print(f"  x {f}", file=sys.stderr)
        return 1
    print("OK — self-test Python cocok dengan docs/05-METHOD-RULES.md.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("export", nargs="?", help="berkas JSON ekspor run")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--report", metavar="PATH", help="tulis laporan JSON untuk diunggah ke aplikasi (G6)")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        sys.exit(self_test())
    if not args.export:
        ap.error("berikan berkas ekspor atau --self-test")
    with open(args.export, "rb") as fh:
        raw = fh.read()
    export = json.loads(raw.decode("utf-8"))
    if args.report:
        # The app accepts the report only for the export it can regenerate
        # byte for byte (same SHA-256), so a stale or edited file is refused.
        diffs = compare(export)
        report = {
            "tool": "scripts/recompute.py",
            "exportSha256": hashlib.sha256(raw).hexdigest(),
            "tolerance": TOLERANCE,
            "ok": not diffs,
            "diffCount": len(diffs),
            "diffs": diffs,
            "counts": {k: len(export.get(k, [])) for k in ("delphiItems", "ahpMatrices", "ahpAggregates", "assessments")},
            "python": platform.python_version(),
            "numpy": np.__version__,
        }
        with open(args.report, "w", encoding="utf-8") as out:
            json.dump(report, out, ensure_ascii=False, indent=2)
        print(("OK" if not diffs else f"{len(diffs)} PERBEDAAN") + f" — laporan ditulis ke {args.report}")
        sys.exit(0 if not diffs else 1)
    sys.exit(check(export))
