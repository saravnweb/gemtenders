
import "dotenv/config";
import { supabase } from "./lib/supabase";

async function check() {
    const { count, error } = await supabase.from("tenders").select("*", { count: "exact", head: true });
    if (error) console.error("Error:", error);
    else console.log("Total tenders in DB:", count);
    
    const { data: latest } = await supabase.from("tenders").select("bid_number, title, created_at").order("created_at", { ascending: false }).limit(5);
    console.log("Latest 5 tenders:", JSON.stringify(latest, null, 2));
}

check();
