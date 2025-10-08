import axios, { AxiosInstance } from 'axios';
import { HttpAdapter } from '../interfaces/http-adapter.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AxiosAdapter implements HttpAdapter {
  private axios: AxiosInstance = axios;

  async get<T>(url: string): Promise<T>;
  async get<T>(url: string, config: any): Promise<T>;
  async get<T>(url: string, config?: any): Promise<T> {
    try {
      const { data } = await this.axios.get<T>(url, config);
      return data;
    } catch (error) {
      console.error('AxiosAdapter error:', error?.response?.data || error);
      throw new Error('This is an error - Check logs');
    }
  }
}
