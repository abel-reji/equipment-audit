import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function csvCell(value: string | number | null | undefined) {
  const normalized = String(value ?? "");
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return `${values.map(csvCell).join(",")}\n`;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const id = url.searchParams.get("id");

    if ((scope !== "customer" && scope !== "site") || !id) {
      return NextResponse.json({ error: "Missing or invalid export scope" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    let siteIds: string[] = [];
    let exportLabel = "";

    if (scope === "customer") {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("id", id)
        .single();

      if (customerError || !customer) {
        throw new Error(customerError?.message ?? "Customer not found");
      }

      exportLabel = customer.name;

      const { data: customerSites, error: sitesError } = await supabase
        .from("sites")
        .select("id")
        .eq("customer_id", id);

      if (sitesError) {
        throw sitesError;
      }

      siteIds = (customerSites ?? []).map((site) => site.id);
    } else {
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("id, name")
        .eq("id", id)
        .single();

      if (siteError || !site) {
        throw new Error(siteError?.message ?? "Site not found");
      }

      exportLabel = site.name;
      siteIds = [site.id];
    }

    if (!siteIds.length) {
      const emptyCsv = csvRow([
        "customer",
        "site",
        "equipment_type",
        "equipment_tag",
        "manufacturer",
        "model",
        "serial",
        "status",
        "service_application",
        "temporary_identifier",
        "quick_note",
        "latitude",
        "longitude",
        "location_accuracy_meters",
        "location_captured_at",
        "driver_motor_oem",
        "driver_motor_model",
        "driver_serial_number",
        "driver_hp",
        "driver_rpm",
        "driver_voltage",
        "driver_frame",
        "coupling_oem",
        "coupling_type",
        "coupling_size",
        "coupling_spacer",
        "coupling_notes",
        "capture_status",
        "captured_at",
        "updated_at"
      ]);

      return new NextResponse(emptyCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${scope}-${toSlug(exportLabel || "export")}.csv"`
        }
      });
    }

    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("*, sites(*, customers(*)), asset_drivers(*), asset_couplings(*)")
      .in("site_id", siteIds)
      .order("updated_at", { ascending: false });

    if (assetsError) {
      throw assetsError;
    }

    const header = csvRow([
      "customer",
      "site",
      "equipment_type",
      "equipment_tag",
      "manufacturer",
      "model",
      "serial",
      "status",
      "service_application",
      "temporary_identifier",
      "quick_note",
      "latitude",
      "longitude",
      "location_accuracy_meters",
      "location_captured_at",
      "driver_motor_oem",
      "driver_motor_model",
      "driver_serial_number",
      "driver_hp",
      "driver_rpm",
      "driver_voltage",
      "driver_frame",
      "coupling_oem",
      "coupling_type",
      "coupling_size",
      "coupling_spacer",
      "coupling_notes",
      "capture_status",
      "captured_at",
      "updated_at"
    ]);

    const rows = (assets ?? [])
      .map((asset) => {
        const site = Array.isArray(asset.sites) ? asset.sites[0] : asset.sites;
        const customer = site && Array.isArray(site.customers) ? site.customers[0] : site?.customers;
        const driver = Array.isArray(asset.asset_drivers) ? asset.asset_drivers[0] : asset.asset_drivers;
        const coupling = Array.isArray(asset.asset_couplings)
          ? asset.asset_couplings[0]
          : asset.asset_couplings;

        return csvRow([
          customer?.name,
          site?.name,
          asset.equipment_type,
          asset.equipment_tag,
          asset.manufacturer,
          asset.model,
          asset.serial,
          asset.status,
          asset.service_application,
          asset.temporary_identifier,
          asset.quick_note,
          asset.latitude,
          asset.longitude,
          asset.location_accuracy_meters,
          asset.location_captured_at,
          driver?.motor_oem,
          driver?.motor_model,
          driver?.serial_number,
          driver?.hp,
          driver?.rpm,
          driver?.voltage,
          driver?.frame,
          coupling?.oem,
          coupling?.coupling_type,
          coupling?.size,
          coupling?.spacer,
          coupling?.notes,
          asset.capture_status,
          asset.captured_at,
          asset.updated_at
        ]);
      })
      .join("");

    return new NextResponse(`${header}${rows}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${scope}-${toSlug(exportLabel)}.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export report" },
      { status: 400 }
    );
  }
}
