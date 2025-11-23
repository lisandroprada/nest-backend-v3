export enum AgenteRoles {
  // Roles de Negocio
  CLIENTE = 'CLIENTE',
  LOCADOR = 'LOCADOR',
  LOCATARIO = 'LOCATARIO',
  FIADOR = 'FIADOR',

  // Roles Operacionales
  PROVEEDOR = 'PROVEEDOR',
  PROVEEDOR_SERVICIO_PUBLICO = 'PROVEEDOR_SERVICIO_PUBLICO', // Camuzzi, Cooperativas, Municipalidades, EPRE, etc.
  INMOBILIARIA = 'INMOBILIARIA', // Usado para el agente que representa la empresa.
  COMPRADOR = 'COMPRADOR',
  VENDEDOR = 'VENDEDOR',
}
