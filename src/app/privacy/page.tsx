import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — GlycoFit",
  description: "Política de privacidad y protección de datos personales de GlycoFit",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-8">Última actualización: 24 de agosto de 2026</p>

        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>GlycoFit</strong> es una aplicación desarrollada como instrumento de un estudio clínico
            sobre adherencia al automonitoreo en diabetes tipo 2, dirigido por el Dr. Alfredo Strubia en el
            marco de la Sociedad Argentina de Gerontología y Geriatría.
          </p>
          <p>
            Responsable del tratamiento de datos: Juan Cruz Lambrechts.<br />
            Contacto: <a href="mailto:juancruzlambrechts@gmail.com" className="text-green-700 underline">juancruzlambrechts@gmail.com</a>
          </p>
        </Section>

        <Section title="2. Marco legal">
          <p>
            El tratamiento de datos personales se rige por la Ley N.° 25.326 de Protección de Datos Personales
            de la República Argentina, su Decreto Reglamentario 1558/2001, y las disposiciones de la Agencia
            de Acceso a la Información Pública (AAIP). Los datos sensibles de salud reciben protección
            especial conforme al artículo 7 de dicha ley y solo se tratan con el consentimiento expreso e
            informado del titular.
          </p>
        </Section>

        <Section title="3. Datos que recopilamos">
          <p>Recopilamos las siguientes categorías de datos personales:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Datos de identificación:</strong> nombre, apellido, dirección de correo electrónico, fecha de nacimiento, género.</li>
            <li><strong>Datos de salud:</strong> mediciones de glucemia, presión arterial y peso; resultados de análisis de laboratorio; historia clínica (diagnósticos, medicación, antecedentes); registros de controles médicos (seguimiento médico).</li>
            <li><strong>Datos de uso:</strong> fechas y horarios de acceso a la aplicación, interacciones con mensajes y recordatorios.</li>
            <li><strong>Datos técnicos:</strong> token de dispositivo para notificaciones push, plataforma del dispositivo (Android/iOS).</li>
          </ul>
        </Section>

        <Section title="4. Finalidad del tratamiento">
          <p>Sus datos son utilizados exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Registrar y mostrar sus mediciones de salud y evolución clínica.</li>
            <li>Compartir su información con su equipo médico asignado dentro de la plataforma.</li>
            <li>Enviarle recordatorios personalizados y mensajes de seguimiento.</li>
            <li>Generar alertas de seguridad ante lecturas peligrosas (ej.: hipoglucemia severa, crisis hipertensiva).</li>
            <li>Participar en un estudio clínico sobre adherencia al automonitoreo en diabetes tipo 2 en adultos mayores.</li>
            <li>Análisis estadístico anonimizado con fines de investigación.</li>
          </ul>
        </Section>

        <Section title="5. Servicios terceros que procesan datos">
          <p>
            Para el funcionamiento de la aplicación, ciertos datos pueden ser procesados por servicios
            tecnológicos de terceros. Todos los datos se transmiten de forma encriptada (HTTPS/TLS).
          </p>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-green-50 text-left">
                  <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Servicio</th>
                  <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Proveedor</th>
                  <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Datos que recibe</th>
                  <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-700">Finalidad</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-medium">Gemini AI</td>
                  <td className="border border-gray-200 px-3 py-2">Google LLC (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Imágenes de análisis clínicos; variables de contexto para personalización (nombre, última glucemia)</td>
                  <td className="border border-gray-200 px-3 py-2">Extracción de valores de laboratorio; personalización de mensajes</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-medium">Cloudinary</td>
                  <td className="border border-gray-200 px-3 py-2">Cloudinary Ltd. (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Archivos adjuntos de controles médicos (fotos, PDFs)</td>
                  <td className="border border-gray-200 px-3 py-2">Almacenamiento de documentos clínicos</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-medium">Firebase (FCM)</td>
                  <td className="border border-gray-200 px-3 py-2">Google LLC (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Tokens de dispositivo, contenido de notificaciones</td>
                  <td className="border border-gray-200 px-3 py-2">Entrega de notificaciones push</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-medium">Expo (EAS)</td>
                  <td className="border border-gray-200 px-3 py-2">650 Industries Inc. (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Tokens de dispositivo, contenido de notificaciones</td>
                  <td className="border border-gray-200 px-3 py-2">Distribución de la aplicación y notificaciones push</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2 font-medium">Backblaze B2</td>
                  <td className="border border-gray-200 px-3 py-2">Backblaze Inc. (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Copia encriptada de la base de datos</td>
                  <td className="border border-gray-200 px-3 py-2">Respaldos nocturnos para prevención de pérdida de datos</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2 font-medium">Resend</td>
                  <td className="border border-gray-200 px-3 py-2">Resend Inc. (EE.UU.)</td>
                  <td className="border border-gray-200 px-3 py-2">Dirección de correo electrónico, contenido de emails transaccionales</td>
                  <td className="border border-gray-200 px-3 py-2">Verificación de cuenta y recuperación de contraseña</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4">
            El servidor principal está alojado en <strong>Hetzner Online GmbH</strong> (centro de datos en
            Ashburn, Virginia, EE.UU.), accesible solo mediante SSH con clave privada.
          </p>
        </Section>

        <Section title="6. Transferencia internacional de datos">
          <p>
            Los datos pueden ser transferidos a servidores ubicados en Estados Unidos y Alemania para su
            procesamiento por los servicios terceros mencionados. Estas transferencias se realizan con su
            consentimiento expreso y se encuentran amparadas por el artículo 12 de la Ley 25.326, que permite
            la transferencia internacional cuando el titular ha dado su consentimiento inequívoco.
          </p>
        </Section>

        <Section title="7. Retención de datos">
          <ul className="list-disc pl-6 space-y-1">
            <li>Los datos de salud y del estudio se conservan durante la duración del estudio clínico (6 meses) y un período de retención posterior para análisis.</li>
            <li>Los respaldos de base de datos se mantienen por 30 días (diarios) y 6 meses (mensuales).</li>
            <li>Los datos procesados por Gemini AI y Expo son transitorios y no se almacenan después del procesamiento.</li>
            <li>Usted puede solicitar la eliminación de sus datos en cualquier momento (ver sección 8).</li>
          </ul>
        </Section>

        <Section title="8. Derechos del titular de los datos">
          <p>
            Conforme a la Ley 25.326, usted tiene derecho a:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Acceso:</strong> solicitar información sobre los datos personales que tenemos sobre usted. Puede descargar sus datos desde la sección &quot;Mi cuenta&quot; en la aplicación.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de sus datos personales. Puede hacerlo desde la sección &quot;Mi cuenta&quot; o contactándonos por correo electrónico.</li>
            <li><strong>Retiro del consentimiento:</strong> retirar su consentimiento para el tratamiento de datos en cualquier momento, sin que ello afecte la licitud del tratamiento previo.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, contacte a{" "}
            <a href="mailto:juancruzlambrechts@gmail.com" className="text-green-700 underline">juancruzlambrechts@gmail.com</a>.
            Responderemos en un plazo máximo de 10 días hábiles conforme a la normativa vigente.
          </p>
        </Section>

        <Section title="9. Seguridad de los datos">
          <p>Implementamos las siguientes medidas de seguridad:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Cifrado en tránsito (HTTPS/TLS) para todas las comunicaciones.</li>
            <li>Contraseñas almacenadas con hash bcrypt (nunca en texto plano).</li>
            <li>Autenticación mediante tokens JWT con expiración.</li>
            <li>Acceso al servidor restringido por SSH con clave privada.</li>
            <li>Respaldos nocturnos automatizados con verificación de integridad.</li>
            <li>Separación de roles (paciente, médico, administrador) con control de acceso.</li>
          </ul>
        </Section>

        <Section title="10. Menores de edad">
          <p>
            GlycoFit está dirigido exclusivamente a adultos mayores de 18 años. No recopilamos
            intencionalmente datos de menores de edad.
          </p>
        </Section>

        <Section title="11. Cambios en esta política">
          <p>
            Nos reservamos el derecho de modificar esta política de privacidad. Cualquier cambio será
            publicado en esta página con la fecha de actualización correspondiente. Si los cambios son
            significativos, le notificaremos a través de la aplicación.
          </p>
        </Section>

        <Section title="12. Contacto y reclamos">
          <p>
            Para consultas, reclamos o ejercicio de derechos, contacte a:<br />
            <strong>Email:</strong>{" "}
            <a href="mailto:juancruzlambrechts@gmail.com" className="text-green-700 underline">juancruzlambrechts@gmail.com</a>
          </p>
          <p>
            Asimismo, tiene derecho a presentar una denuncia ante la Agencia de Acceso a la Información
            Pública (AAIP) si considera que sus datos están siendo tratados de manera indebida.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-400">
          GlycoFit — Tu salud, bajo control
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
