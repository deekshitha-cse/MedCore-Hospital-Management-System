# Database Design — MedCore HMS

## Core Entities

- **Hospital** — a tenant on the platform; everything else belongs to one hospital (except Super Admins).
- **Address** — reusable location record, linked to Hospital and Patient.
- **User** — shared account/auth data (email, password, role) for every person in the system.
- **Doctor / Patient** — role-specific profiles, each one-to-one with a User.
- **Department** — a hospital's organizational unit (e.g., Cardiology).
- **Room** — a physical space in a hospital, optionally tied to a department.
- **DoctorDepartment** — join table; a doctor can work in many departments.
- **Appointment** — a booked visit between a doctor and patient.
- **MedicalRecord** — the clinical encounter record created per appointment; append-only, never deleted.
- **Vaccination / AttachedFile** — supporting records tied to a MedicalRecord.
- **Prescription / PrescriptionItem / Medicine** — a prescription is a header; each medicine prescribed is its own line item with dosage/frequency/duration.
- **Pharmacy / MedicineBatch** — inventory tracking; each batch has its own expiry/quantity.
- **LabOrder / LabOrderItem / LabTest** — a lab order is a header; each requested test is its own line item with its own result.
- **Invoice / InvoiceItem** — one invoice per visit, aggregating charges (consultation, lab, medicine, room) as separate line items.
- **Notification** — in-app/email/SMS alerts sent to a User.
- **AuditLog** — records every create/update/delete action, who did it, and from what IP.

## Tenancy

Every hospital-specific entity carries a `hospitalId` foreign key (Room, Department, User, Doctor, Patient, Appointment, MedicalRecord, Medicine, Pharmacy, Invoice, LabTest, LabOrder, Notification, AuditLog). This lets the application enforce that no request can ever read or write another hospital's data.

`User.hospitalId` is optional — Super Admins operate across all hospitals and have no single tenant.

## Key Relationships

- **Doctor ↔ Department** is many-to-many via `DoctorDepartment`, since a doctor can work across multiple departments.
- **Prescription → PrescriptionItem → Medicine** and **LabOrder → LabOrderItem → LabTest** both follow the same header/line-item pattern: the header links to the encounter, each line item links to a catalog entry (Medicine or LabTest) plus its own specific details.
- **Invoice → InvoiceItem** aggregates every charge from a visit (consultation, lab, medicine, room) as individual rows rather than fixed columns, so any number/category of charges can be billed on one invoice.
- **MedicalRecord** is the hub connecting Appointment, Patient, Doctor, Prescription, Vaccination, AttachedFile, and LabOrder for a single encounter.
- **AuditLog** references "any entity" via plain `entityName`/`entityId` string fields rather than a typed relation, since Prisma relations can't point to an unspecified model.

## Notable Constraints

- `@@unique([hospitalId, roomNumber])` and `@@unique([hospitalId, name])` prevent duplicate room numbers/department names within the same hospital, while allowing the same values across different hospitals.
- `User.email` is globally unique — login doesn't scope by hospital.
- `Doctor.userId`, `Patient.userId`, `Hospital.addressId`, `Patient.addressId`, and `MedicalRecord.appointmentId` are all `@unique`, enforcing genuine one-to-one relationships.
- Soft deletion (`deletedAt`) is implemented on `Patient`, `Doctor`, and `Appointment` — rows are hidden, never physically removed, so historical records referencing them stay intact.
- `MedicalRecord` has no `deletedAt` and no deletion mechanism at all — it is append-only by design, per both legal and clinical requirements.