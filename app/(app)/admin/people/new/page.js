import PersonForm from "@/components/PersonForm";
import { createPerson } from "../actions";

export default function NewPersonPage() {
  return (
    <>
      <div className="section-header">
        <h2>Add person</h2>
      </div>
      <PersonForm action={createPerson} />
    </>
  );
}
