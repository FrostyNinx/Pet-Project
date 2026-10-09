using System;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Threading;

namespace PixelPetPicker
{
    static class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetProcessDpiAwarenessContext(int dpiFlag);

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main()
        {
            try {
                if (!SetProcessDpiAwarenessContext(-4)) {
                    SetProcessDPIAware();
                }
            } catch {
                try { SetProcessDPIAware(); } catch {}
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Rectangle bounds = SystemInformation.VirtualScreen;

            Form form = new Form();
            form.FormBorderStyle = FormBorderStyle.None;
            form.StartPosition = FormStartPosition.Manual;
            form.Location = bounds.Location;
            form.Size = bounds.Size;
            form.TopMost = true;
            form.ShowInTaskbar = false;
            form.BackColor = Color.Black;
            form.Opacity = 0.01;
            form.Cursor = Cursors.Cross;

            form.KeyDown += (s, e) => {
                if (e.KeyCode == Keys.Escape) {
                    form.Close();
                }
            };

            form.MouseDown += (s, e) => {
                if (e.Button == MouseButtons.Left) {
                    Point mousePt = Cursor.Position;
                    form.Hide();
                    Thread.Sleep(20);
                    using (Bitmap bmp = new Bitmap(1, 1))
                    {
                        using (Graphics g = Graphics.FromImage(bmp))
                        {
                            g.CopyFromScreen(mousePt.X, mousePt.Y, 0, 0, new Size(1, 1), CopyPixelOperation.SourceCopy);
                        }
                        Color pixel = bmp.GetPixel(0, 0);
                        Console.Write(string.Format("#{0:X2}{1:X2}{2:X2}", pixel.R, pixel.G, pixel.B));
                        Console.Out.Flush();
                    }
                    form.Close();
                } else if (e.Button == MouseButtons.Right) {
                    form.Close();
                }
            };

            Application.Run(form);
        }
    }
}
