import PersonForm from "@/components/PersonForm";
import { updatePerson } from "../../actions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";

export default async function EditPersonPage({ params }) {
  const email = decodeURIComponent(params.email);
  const supabase = createSupabaseServerClient();
  const { data: person } = await supabase
    .from("employee_master")
    .select("*")
    .eq("email", email)
    .single();

  if (!person) notFound();

  const boundAction = updatePerson.bind(null, email);

  return (
    <>
      <div className="section-header">
        <h2>Edit {person.full_name}</h2>
      </div>
      <PersonForm action={boundAction} initial={person} isEdit />
    </>
  );
}
