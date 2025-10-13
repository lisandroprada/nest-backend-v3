import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CuitData } from './interfaces/cuit-data.interface';

@Injectable()
export class CuitService {
  private readonly baseUrl = 'https://www.cuitonline.com/search/';

  /**
   * Consulta información de CUIT desde cuitonline.com usando Cheerio
   * Extrae datos del HTML estático - no requiere JavaScript
   */
  async consultarCuitPorDni(dni: string): Promise<CuitData> {
    const url = `${this.baseUrl}${dni}`;

    try {
      // Realizar request con axios
      const { data: html } = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        },
        timeout: 10000,
      });

      // Cargar HTML con Cheerio
      const $ = cheerio.load(html);

      // Buscar el div.hit que contiene la información
      const hitDiv = $('div.hit').first();

      if (!hitDiv.length) {
        throw new BadRequestException(
          `No se encontraron resultados para el DNI ${dni}. Intente usar el endpoint /generar/${dni} para obtener CUITs posibles.`,
        );
      }

      // Extraer nombre (desde h2.denominacion)
      const nombre = hitDiv.find('h2.denominacion').text().trim();

      // Extraer CUIT (desde span.cuit)
      const cuit = hitDiv.find('span.cuit').text().trim() || 'No encontrado';

      // Extraer tipo de persona desde div.doc-facets
      const docFacetsText = hitDiv.find('div.doc-facets').text();

      // Buscar tipo de persona (Persona Física/Jurídica con género)
      const tipoPersonaMatch = docFacetsText.match(
        /Persona\s+(Física|Jurídica)\s*\((masculino|femenino)\)/i,
      );
      const tipoPersona = tipoPersonaMatch
        ? `Persona ${tipoPersonaMatch[1]} (${tipoPersonaMatch[2]})`
        : '';

      // Para extraer Ganancias e IVA, usamos HTML para poder hacer regex correcto
      const docFacetsHtml = hitDiv.find('div.doc-facets').html() || '';

      // Extraer Ganancias e IVA y limpiar &nbsp;
      const gananciasMatch = docFacetsHtml.match(/Ganancias:\s*([^<\n]+)/i);
      const ganancias = gananciasMatch
        ? gananciasMatch[1].replace(/&nbsp;/g, ' ').trim()
        : '';

      const ivaMatch = docFacetsHtml.match(/IVA:\s*([^<\n]+)/i);
      const iva = ivaMatch ? ivaMatch[1].replace(/&nbsp;/g, ' ').trim() : '';

      // Validar que se encontró información
      if (!nombre || nombre === '' || nombre.match(/^R+$/)) {
        // El sitio devuelve "RRRRRRRRRRRRRRRRRRRR" para DNIs inexistentes
        throw new BadRequestException(
          `No se encontraron resultados para el DNI ${dni}. Intente usar el endpoint /generar/${dni} para obtener CUITs posibles.`,
        );
      }

      return {
        nombre,
        cuit,
        tipoPersona,
        ganancias,
        iva,
      };
    } catch (error) {
      // Si es BadRequestException (no encontrado), re-lanzarla
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Para otros errores (timeout, red, etc.)
      console.warn(
        `⚠️ Web scraping CUIT falló para DNI ${dni}:`,
        error.message,
      );

      throw new InternalServerErrorException(
        `Error al consultar CUIT desde el sitio externo. Use el endpoint /generar/${dni} como alternativa confiable.`,
      );
    }
  }

  /**
   * Valida si un CUIT tiene el formato correcto y dígito verificador válido
   * Formato esperado: XX-XXXXXXXX-X o XXXXXXXXXXX
   */
  validarCuit(cuit: string): {
    valido: boolean;
    mensaje: string;
    cuitFormateado?: string;
  } {
    // Remover guiones y espacios
    const cuitLimpio = cuit.replace(/[-\s]/g, '');

    // Verificar longitud
    if (cuitLimpio.length !== 11) {
      return {
        valido: false,
        mensaje: 'El CUIT debe tener 11 dígitos',
      };
    }

    // Verificar que solo contenga números
    if (!/^\d+$/.test(cuitLimpio)) {
      return {
        valido: false,
        mensaje: 'El CUIT solo debe contener números',
      };
    }

    // Extraer partes del CUIT
    const tipo = parseInt(cuitLimpio.substring(0, 2));
    const documento = cuitLimpio.substring(2, 10);
    const digitoVerificador = parseInt(cuitLimpio.charAt(10));

    // Validar tipo de CUIT (prefijo)
    const tiposValidos = [20, 23, 24, 27, 30, 33, 34];
    if (!tiposValidos.includes(tipo)) {
      return {
        valido: false,
        mensaje: `Tipo de CUIT inválido: ${tipo}. Debe ser uno de: ${tiposValidos.join(', ')}`,
      };
    }

    // Calcular dígito verificador
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 10; i++) {
      suma += parseInt(cuitLimpio.charAt(i)) * multiplicadores[i];
    }

    const resto = suma % 11;
    const digitoCalculado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;

    if (digitoCalculado !== digitoVerificador) {
      return {
        valido: false,
        mensaje: `Dígito verificador incorrecto. Esperado: ${digitoCalculado}, Recibido: ${digitoVerificador}`,
      };
    }

    // Formatear CUIT
    const cuitFormateado = `${cuitLimpio.substring(0, 2)}-${documento}-${digitoVerificador}`;

    return {
      valido: true,
      mensaje: 'CUIT válido',
      cuitFormateado,
    };
  }

  /**
   * Genera posibles CUITs a partir de un DNI
   * Devuelve todas las combinaciones posibles (masculino, femenino, empresa)
   */
  generarCuitsDesdeDocumento(documento: string): {
    documento: string;
    cuits: Array<{
      cuit: string;
      tipo: string;
      descripcion: string;
    }>;
  } {
    // Limpiar documento (remover puntos y espacios)
    const documentoLimpio = documento.replace(/[.\s]/g, '');

    // Verificar que sea un número de 7 u 8 dígitos
    if (!/^\d{7,8}$/.test(documentoLimpio)) {
      throw new BadRequestException(
        'El documento debe tener 7 u 8 dígitos numéricos',
      );
    }

    // Rellenar con ceros a la izquierda si tiene 7 dígitos
    const doc = documentoLimpio.padStart(8, '0');

    const cuits = [];

    // Definir prefijos y sus descripciones
    const prefijos = [
      {
        codigo: 20,
        tipo: 'Masculino',
        descripcion: 'Persona Física - Masculino',
      },
      {
        codigo: 27,
        tipo: 'Femenino',
        descripcion: 'Persona Física - Femenino',
      },
      {
        codigo: 23,
        tipo: 'Masculino',
        descripcion: 'Persona Física - Masculino (alternativo)',
      },
      {
        codigo: 24,
        tipo: 'Femenino',
        descripcion: 'Persona Física - Femenino (alternativo)',
      },
      { codigo: 30, tipo: 'Jurídica', descripcion: 'Persona Jurídica' },
      {
        codigo: 33,
        tipo: 'Jurídica',
        descripcion: 'Persona Jurídica (alternativo)',
      },
      { codigo: 34, tipo: 'Jurídica', descripcion: 'Persona Jurídica (otro)' },
    ];

    // Generar CUIT para cada prefijo
    for (const prefijo of prefijos) {
      const digitoVerificador = this.calcularDigitoVerificador(
        `${prefijo.codigo}${doc}`,
      );
      const cuit = `${prefijo.codigo}-${doc}-${digitoVerificador}`;

      cuits.push({
        cuit,
        tipo: prefijo.tipo,
        descripcion: prefijo.descripcion,
      });
    }

    return {
      documento: doc,
      cuits,
    };
  }

  /**
   * Calcula el dígito verificador para un CUIT sin el dígito final
   */
  private calcularDigitoVerificador(cuitSinDigito: string): number {
    const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 10; i++) {
      suma += parseInt(cuitSinDigito.charAt(i)) * multiplicadores[i];
    }

    const resto = suma % 11;
    return resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  }
}
