import { BRAND_NAME } from './brand'
import { SITE_EMAIL } from './siteContact'

export type LegalPageId = 'privacy' | 'terms'

export type LegalSection = {
  title: string
  paragraphs: string[]
}

export type LegalPageContent = {
  id: LegalPageId
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export const PRIVACY_PAGE: LegalPageContent = {
  id: 'privacy',
  title: 'Política de privacidad',
  updated: '4 de junio de 2026',
  intro: `En ${BRAND_NAME} respetamos tu privacidad. Esta política describe qué datos recopilamos, para qué los usamos y cuáles son tus derechos.`,
  sections: [
    {
      title: '1. Responsable del tratamiento',
      paragraphs: [
        `${BRAND_NAME} es el responsable del tratamiento de los datos personales que nos proporcionás al usar el sitio web, solicitar acceso o utilizar la plataforma.`,
        `Para consultas sobre privacidad podés escribir a ${SITE_EMAIL}.`,
      ],
    },
    {
      title: '2. Datos que recopilamos',
      paragraphs: [
        'Datos de contacto y empresa: nombre, email, teléfono, nombre del negocio y mensajes que envíes al solicitar acceso.',
        'Datos de cuenta: credenciales de acceso, rol dentro de la empresa y preferencias de uso.',
        'Datos operativos del negocio: ventas, inventario, compras, productos, clientes y demás información que cargues en la plataforma.',
        'Datos técnicos: dirección IP, tipo de navegador, dispositivo y registros de uso para seguridad y mejora del servicio.',
      ],
    },
    {
      title: '3. Finalidad del tratamiento',
      paragraphs: [
        'Operar y mantener la plataforma, incluido POS, panel administrativo y asistente IA.',
        'Gestionar solicitudes de acceso, onboarding y soporte.',
        'Mejorar funciones, seguridad y experiencia de uso.',
        'Cumplir obligaciones legales y resolver incidencias.',
      ],
    },
    {
      title: '4. Base legal',
      paragraphs: [
        'Tratamos tus datos con base en la ejecución del servicio solicitado, tu consentimiento al registrarte o contactarnos, y nuestro interés legítimo en operar y mejorar la plataforma de forma segura.',
      ],
    },
    {
      title: '5. Conservación y seguridad',
      paragraphs: [
        'Conservamos los datos mientras mantengas una cuenta activa o sea necesario para las finalidades descritas.',
        'Aplicamos medidas técnicas y organizativas razonables para proteger la información contra acceso no autorizado, pérdida o alteración.',
      ],
    },
    {
      title: '6. Compartición con terceros',
      paragraphs: [
        'No vendemos tus datos personales.',
        'Podemos usar proveedores de infraestructura, mensajería o IA estrictamente necesarios para prestar el servicio, bajo acuerdos de confidencialidad y tratamiento.',
      ],
    },
    {
      title: '7. Tus derechos',
      paragraphs: [
        'Podés solicitar acceso, actualización, corrección o eliminación de tus datos, así como oponerte a ciertos tratamientos cuando la ley lo permita.',
        `Envía tu solicitud a ${SITE_EMAIL}. Responderemos en un plazo razonable.`,
      ],
    },
    {
      title: '8. Cambios',
      paragraphs: [
        'Podemos actualizar esta política. Publicaremos la versión vigente en esta página con la fecha de última actualización.',
      ],
    },
  ],
}

export const TERMS_PAGE: LegalPageContent = {
  id: 'terms',
  title: 'Términos y condiciones',
  updated: '4 de junio de 2026',
  intro: `Al acceder al sitio o usar ${BRAND_NAME}, aceptás estos términos. Si no estás de acuerdo, no utilices el servicio.`,
  sections: [
    {
      title: '1. El servicio',
      paragraphs: [
        `${BRAND_NAME} es una plataforma de gestión empresarial con asistente de inteligencia artificial. Durante la etapa actual el acceso puede ser limitado y algunas funciones pueden cambiar según la validación con usuarios reales.`,
      ],
    },
    {
      title: '2. Cuentas y acceso',
      paragraphs: [
        'El acceso es personal para tu empresa. Sos responsable de mantener la confidencialidad de tus credenciales y de la actividad realizada bajo tu cuenta.',
        'Debés proporcionar información veraz al solicitar acceso y mantenerla actualizada.',
      ],
    },
    {
      title: '3. Uso permitido',
      paragraphs: [
        'Podés usar la plataforma para administrar la operación legítima de tu negocio.',
        'No está permitido usar el servicio para actividades ilegales, intentar acceder a datos de otras empresas, interferir con la seguridad del sistema ni realizar ingeniería inversa no autorizada.',
      ],
    },
    {
      title: '4. Contenido y datos del negocio',
      paragraphs: [
        'Conservás la titularidad de los datos que cargues en la plataforma.',
        'Nos otorgás una licencia limitada para alojar, procesar y analizar esos datos con el fin de prestar el servicio, incluidas funciones de IA y reportes.',
      ],
    },
    {
      title: '5. Asistente IA',
      paragraphs: [
        'Las respuestas del asistente se basan en la información disponible en tu cuenta y pueden contener errores o estimaciones.',
        'Las decisiones comerciales, financieras o legales son tu responsabilidad. El asistente es una herramienta de apoyo, no un asesor profesional.',
      ],
    },
    {
      title: '6. Disponibilidad',
      paragraphs: [
        'Buscamos alta disponibilidad, pero no garantizamos que el servicio esté libre de interrupciones.',
        'Podemos realizar mantenimientos, actualizaciones o cambios en funciones con aviso razonable cuando sea posible.',
      ],
    },
    {
      title: '7. Suspensión',
      paragraphs: [
        'Podemos suspender o cancelar el acceso si incumplís estos términos, si hay riesgo de seguridad o uso indebido, o si dejamos de ofrecer el servicio a tu organización.',
      ],
    },
    {
      title: '8. Limitación de responsabilidad',
      paragraphs: [
        'El servicio se provee “tal cual” en la medida permitida por la ley.',
        `${BRAND_NAME} no será responsable por pérdidas indirectas, lucro cesante o daños derivados del uso o imposibilidad de uso de la plataforma, salvo disposición legal en contrario.`,
      ],
    },
    {
      title: '9. Contacto',
      paragraphs: [
        `Para consultas sobre estos términos escribí a ${SITE_EMAIL}.`,
      ],
    },
  ],
}

export function getLegalPage(id: LegalPageId): LegalPageContent {
  return id === 'privacy' ? PRIVACY_PAGE : TERMS_PAGE
}
