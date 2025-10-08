import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NlpService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GOOGLE_GEMINI_API_KEY no está configurada.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Modelo por defecto actualizado para API v1beta
    this.modelName =
      this.configService.get<string>('GOOGLE_GEMINI_MODEL') ||
      'gemini-1.5-flash';
  }

  /**
   * Analiza el texto de una descripción de propiedad y devuelve un score de calidad.
   * El score se basa en si la descripción es positiva, neutra o negativa.
   * @param text La descripción de la propiedad.
   * @returns Un valor numérico entre 0 y 100 que representa el score de calidad.
   */
  public async analyzeText(text: string): Promise<number> {
    if (!text || text.trim().length === 0) {
      return 0; // Si no hay texto, el score es 0
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      // Envía el texto a la API de Gemini con un prompt específico
      const prompt = `Analiza la siguiente descripción de una propiedad inmobiliaria. Evalúa el estado de la propiedad y la calidad de la descripción en una escala del 0 (muy negativa, mal estado) a 100 (muy positiva, excelente estado). Responde únicamente con el número.

      Descripción: "${text}"

      Puntaje:`;

      const result = await model.generateContent(prompt);
      const scoreText = result.response.text();
      const score = parseInt(scoreText, 10);

      if (isNaN(score)) {
        console.error(
          'La respuesta de la IA no es un número válido:',
          scoreText,
        );
        return 50; // Retorna un valor neutro en caso de error
      }

      return Math.max(0, Math.min(100, score)); // Asegura que el score esté entre 0 y 100
    } catch (error) {
      // Mantener ejecución retornando un valor neutro
      console.error('Error al comunicarse con la API de Gemini:', error);
      return 50; // Retorna un valor neutro en caso de fallo de la API
    }
  }
}
