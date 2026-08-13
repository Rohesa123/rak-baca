package id.co.dak.rakbaca;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Harus sama dengan `SKEMA_APLIKASI` di src/lib/shareIntent.ts. */
    private static final String SCHEME = "id.co.dak.rakbaca";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Wajib sebelum super.onCreate: Capacitor membaca intent-nya saat
        // bridge dibangun, jadi penulisan ulang setelah itu tidak akan terlihat.
        rewriteShareIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // Dipakai saat aplikasi sudah berjalan dan pengguna membagikan lagi.
        rewriteShareIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * Mengubah intent "Bagikan" jadi tautan berskema aplikasi ini.
     *
     * Capacitor tidak mengenal ACTION_SEND sama sekali — yang dijembataninya ke
     * JavaScript hanya ACTION_VIEW berikut data URI-nya, lewat `getLaunchUrl`
     * dan `appUrlOpen`. Menuliskan ulang intent di sini membuat kiriman lewat
     * jalur yang sudah ada, sehingga tidak perlu plugin maupun jembatan baru.
     *
     * Teks dan judul dibawa sebagai query parameter, bukan digabung jadi satu:
     * `Uri.Builder` yang meng-encode-nya, sehingga tautan berisi `&` atau spasi
     * tidak merusak URL yang dihasilkan.
     */
    private void rewriteShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        if (text == null && subject == null) {
            return;
        }

        Uri uri = new Uri.Builder()
                .scheme(SCHEME)
                .authority("bagikan")
                .appendQueryParameter("teks", text == null ? "" : text)
                .appendQueryParameter("judul", subject == null ? "" : subject)
                .build();

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(uri);
    }
}
