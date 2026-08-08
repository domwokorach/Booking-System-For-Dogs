declare module "nodemailer" {
  export interface Transporter {
    sendMail(mailOptions: Record<string, unknown>): Promise<unknown>;
  }

  export interface NodemailerModule {
    createTransport(options?: Record<string, unknown>): Transporter;
  }

  const nodemailer: NodemailerModule;
  export default nodemailer;
}
